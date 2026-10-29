// angel-debug — endpoint chẩn đoán RAG / Angel AI cho admin.
// So sánh kết quả Lovable Gateway vs FUN Core API (Cha) với cùng 1 câu hỏi.
// Yêu cầu: caller phải là user có role 'admin' trong bảng public.user_roles.

import { createClient } from "npm:@supabase/supabase-js@2";
import { callAngelCore, AngelCoreError, getAngelProvider } from "../_shared/angel-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type DebugRequest = {
  query: string;
  provider?: "lovable" | "funcore";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing authorization header" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return json(500, { error: "Supabase env not configured" });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData.user) return json(401, { error: "Unauthorized" });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify admin role
    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) return json(500, { error: roleErr.message });
    if (!roleRow) return json(403, { error: "Forbidden — admin role required" });

    const body = (await req.json().catch(() => ({}))) as DebugRequest;
    const query = (body?.query ?? "").toString().trim();
    if (!query) return json(400, { error: "Missing query" });
    if (query.length > 2000) return json(400, { error: "Query too long" });

    const provider = body?.provider ?? getAngelProvider();
    const endpoint = provider === "funcore"
      ? (Deno.env.get("ANGEL_AI_CHAT_URL")
        || "https://zghvgxwdpsapvuvvdgjl.supabase.co/functions/v1/angel-chat")
      : "https://ai.gateway.lovable.dev/v1/chat/completions";

    // Payload tối giản giống askAngel cho funcore — để xem RAG raw trả về.
    const messages = [{ role: "user" as const, content: query }];

    const t0 = Date.now();
    let result;
    try {
      result = await callAngelCore({
        forceProvider: provider,
        model: provider === "lovable" ? "google/gemini-2.5-flash" : undefined,
        max_tokens: 1500,
        messages,
      });
    } catch (e) {
      const dur = Date.now() - t0;
      if (e instanceof AngelCoreError) {
        return json(200, {
          ok: false,
          provider,
          endpoint,
          duration_ms: dur,
          error: { status: e.status, message: e.message, details: e.details },
          request_messages: messages,
        });
      }
      throw e;
    }
    const dur = Date.now() - t0;

    const raw = result.raw as Record<string, unknown> | null;
    const rawKeys = raw && typeof raw === "object" ? Object.keys(raw) : [];

    return json(200, {
      ok: true,
      provider: result.provider,
      endpoint,
      duration_ms: dur,
      request_messages: messages,
      reply_text: result.text,
      reply_length: result.text.length,
      raw_response_keys: rawKeys,
      raw_response: raw,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[angel-debug]", msg);
    return json(500, { error: msg });
  }
});
