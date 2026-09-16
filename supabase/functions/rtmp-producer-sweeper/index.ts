// Cron-driven sweeper that disables Cloudflare Live Inputs for RTMP/OBS
// sessions whose Live Producer page has gone silent.
//
// Triggered by pg_cron every 60s. Only acts on sessions in the pre-public
// phase (waiting_for_obs, source_connected, ready_to_go_live). Public-live
// sessions are intentionally left alone so viewers don't lose the stream.

import { createClient } from "npm:@supabase/supabase-js@2";
import { disableLiveInput } from "../_shared/cloudflareStreamService.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STALE_SECONDS = 60;
const BATCH_LIMIT = 50;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "missing supabase env" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cutoffIso = new Date(Date.now() - STALE_SECONDS * 1000).toISOString();

  // Sessions whose producer presence is stale and ingest is still enabled.
  const { data: stale, error: queryError } = await admin
    .from("live_sessions")
    .select("id, cloudflare_live_input_id, producer_active_at, status, recording_status")
    .eq("mode", "rtmp_obs")
    .eq("producer_input_enabled", true)
    .in("status", ["waiting_for_obs", "source_connected", "ready_to_go_live"])
    .or(`producer_active_at.is.null,producer_active_at.lt.${cutoffIso}`)
    .order("producer_active_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_LIMIT);

  if (queryError) {
    console.error("[rtmp-producer-sweeper] query failed", queryError);
    return json({ error: queryError.message }, 500);
  }

  const rows = stale ?? [];
  let disabled = 0;
  const errors: { id: string; message: string }[] = [];

  for (const row of rows) {
    const sessionId = String(row.id);
    const inputId = row.cloudflare_live_input_id ? String(row.cloudflare_live_input_id) : "";
    try {
      if (inputId) {
        await disableLiveInput(inputId);
      }
      const now = new Date().toISOString();
      const currentRecording = String(row.recording_status || "");
      const shouldResetRecording = currentRecording === "" || currentRecording === "recording" || currentRecording === "idle";
      const patch: Record<string, unknown> = {
        producer_disconnected_at: now,
        producer_input_enabled: false,
        rtmp_status: "waiting",
        status: "waiting_for_obs",
        updated_at: now,
      };
      if (shouldResetRecording) patch.recording_status = "idle";
      await admin.from("live_sessions").update(patch).eq("id", sessionId);
      disabled += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[rtmp-producer-sweeper] failed", sessionId, message);
      errors.push({ id: sessionId, message });
    }
  }

  return json({ ok: true, scanned: rows.length, disabled, errors });
});
