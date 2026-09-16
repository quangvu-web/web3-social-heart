// Admin-only Cloud Usage report edge function.
// Aggregates public.cloud_usage_events + public.telegram_ai_runtime_logs
// theo bucket giờ/ngày/tháng/năm để dựng chart & top-functions cho admin UI.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { mapFeature } from "./feature-map.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

type Range = "hour" | "day" | "month" | "year";
const RANGE_CONFIG: Record<Range, { windowHours: number; bucketMinutes: number; label: string }> = {
  hour: { windowHours: 24, bucketMinutes: 60, label: "24 giờ · bucket 1h" },
  day: { windowHours: 24 * 30, bucketMinutes: 60 * 24, label: "30 ngày · bucket 1 ngày" },
  month: { windowHours: 24 * 365, bucketMinutes: 60 * 24 * 30, label: "12 tháng · bucket 30 ngày" },
  year: { windowHours: 24 * 365 * 5, bucketMinutes: 60 * 24 * 365, label: "5 năm · bucket 1 năm" },
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // --- Auth: admin only ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return jsonResp({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return jsonResp({ error: "unauthorized" }, 401);
    const uid = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return jsonResp({ error: "forbidden" }, 403);

    // --- Params ---
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const range: Range = ["hour", "day", "month", "year"].includes(body.range) ? body.range : "day";
    const cfg = RANGE_CONFIG[range];
    const since = new Date(Date.now() - cfg.windowHours * 3600 * 1000).toISOString();
    const bucketMs = cfg.bucketMinutes * 60 * 1000;

    // --- Query cloud_usage_events ---
    const { data: events, error: evErr } = await admin
      .from("cloud_usage_events")
      .select("function_name, feature, duration_ms, status_code, occurred_at")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(50000);
    if (evErr) return jsonResp({ error: evErr.message }, 500);

    // --- Query telegram_ai_runtime_logs (Angel AI proxy metrics) ---
    const { data: aiLogs } = await admin
      .from("telegram_ai_runtime_logs")
      .select("provider, model, latency_ms, retrieval_time_ms, input_tokens, output_tokens, estimated_cost, cache_hit, error, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50000);

    // --- Aggregate ---
    type FnAgg = {
      function_name: string;
      feature: string;
      invocations: number;
      total_ms: number;
      max_ms: number;
      errors: number;
    };
    const byFn = new Map<string, FnAgg>();
    const byBucket = new Map<number, Map<string, number>>(); // bucketTs → feature → total_ms

    for (const e of events ?? []) {
      const fn = e.function_name as string;
      const feature = mapFeature(fn, (e.feature as string | null) ?? undefined);
      const dur = Number(e.duration_ms || 0);
      const status = Number(e.status_code || 0);
      const bucketTs = Math.floor(new Date(e.occurred_at as string).getTime() / bucketMs) * bucketMs;

      let agg = byFn.get(fn);
      if (!agg) {
        agg = { function_name: fn, feature, invocations: 0, total_ms: 0, max_ms: 0, errors: 0 };
        byFn.set(fn, agg);
      }
      agg.invocations += 1;
      agg.total_ms += dur;
      if (dur > agg.max_ms) agg.max_ms = dur;
      if (status >= 500) agg.errors += 1;

      let b = byBucket.get(bucketTs);
      if (!b) { b = new Map(); byBucket.set(bucketTs, b); }
      b.set(feature, (b.get(feature) ?? 0) + dur);
    }

    // AI logs contribution: latency_ms → total_ms proxy under "Angel AI · <provider>"
    const aiByModel = new Map<string, { model: string; provider: string; calls: number; latency_ms: number; input_tokens: number; output_tokens: number; est_cost: number; errors: number; cache_hits: number }>();
    for (const l of aiLogs ?? []) {
      const key = `${l.provider ?? "unknown"}/${l.model ?? "unknown"}`;
      let a = aiByModel.get(key);
      if (!a) {
        a = { model: l.model ?? "unknown", provider: l.provider ?? "unknown", calls: 0, latency_ms: 0, input_tokens: 0, output_tokens: 0, est_cost: 0, errors: 0, cache_hits: 0 };
        aiByModel.set(key, a);
      }
      a.calls += 1;
      a.latency_ms += Number(l.latency_ms || 0);
      a.input_tokens += Number(l.input_tokens || 0);
      a.output_tokens += Number(l.output_tokens || 0);
      a.est_cost += Number(l.estimated_cost || 0);
      if (l.error) a.errors += 1;
      if (l.cache_hit) a.cache_hits += 1;
    }

    const topFunctions = [...byFn.values()]
      .sort((a, b) => b.total_ms - a.total_ms)
      .map((f) => ({
        ...f,
        avg_ms: f.invocations ? Math.round(f.total_ms / f.invocations) : 0,
      }));
    const totalMs = topFunctions.reduce((s, f) => s + f.total_ms, 0);
    const topFunctionsWithShare = topFunctions.map((f) => ({
      ...f,
      share: totalMs ? +((f.total_ms / totalMs) * 100).toFixed(1) : 0,
    }));

    // Series: sorted array
    const bucketList = [...byBucket.keys()].sort((a, b) => a - b);
    const featureSet = new Set<string>();
    for (const m of byBucket.values()) for (const f of m.keys()) featureSet.add(f);
    const features = [...featureSet];
    const series = bucketList.map((ts) => {
      const row: Record<string, number | string> = { bucket: new Date(ts).toISOString() };
      const m = byBucket.get(ts)!;
      for (const f of features) row[f] = Math.round((m.get(f) ?? 0) / 1000); // compute-seconds
      return row;
    });

    const kpi = {
      invocations: topFunctions.reduce((s, f) => s + f.invocations, 0),
      compute_seconds: Math.round(totalMs / 1000),
      errors_5xx: topFunctions.reduce((s, f) => s + f.errors, 0),
      distinct_functions: topFunctions.length,
      ai_calls: [...aiByModel.values()].reduce((s, a) => s + a.calls, 0),
      ai_input_tokens: [...aiByModel.values()].reduce((s, a) => s + a.input_tokens, 0),
      ai_output_tokens: [...aiByModel.values()].reduce((s, a) => s + a.output_tokens, 0),
      ai_est_cost: +[...aiByModel.values()].reduce((s, a) => s + a.est_cost, 0).toFixed(4),
    };

    return jsonResp({
      ok: true,
      range,
      label: cfg.label,
      since,
      generated_at: new Date().toISOString(),
      kpi,
      features,
      series,
      topFunctions: topFunctionsWithShare,
      aiByModel: [...aiByModel.values()].sort((a, b) => b.calls - a.calls),
      notes: [
        "Nguồn dữ liệu: bảng cloud_usage_events (edge functions tự log) + telegram_ai_runtime_logs (Angel AI). Function chưa được instrument sẽ không xuất hiện — hãy thêm startCloudUsage() ở đầu handler.",
        "Est. cost weight = compute-seconds (total_ms / 1000), dùng làm proxy so sánh tương đối giữa function.",
      ],
    });
  } catch (err) {
    return jsonResp({ error: err instanceof Error ? err.message : "unknown" }, 500);
  }
});
