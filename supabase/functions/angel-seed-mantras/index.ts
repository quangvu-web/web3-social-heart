// One-shot edge function: push "8 Câu Thần Chú Fun Kingdom" vào Angel AI knowledge base gốc.
// Admin-only. Gọi POST /functions/v1/angel-seed-mantras (không cần body).

import { createClient } from "npm:@supabase/supabase-js@2";
import { pushToAngelKnowledge, getAngelKnowledgeStatus } from "../_shared/angel-knowledge.ts";
import {
  FUN_KINGDOM_8_MANTRAS_CANONICAL_CONTENT,
  FUN_KINGDOM_8_MANTRAS_SOURCE,
  FUN_KINGDOM_8_MANTRAS_SOURCE_REF,
} from "../_shared/angel-mantras.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SOURCE = FUN_KINGDOM_8_MANTRAS_SOURCE;
const SOURCE_REF = FUN_KINGDOM_8_MANTRAS_SOURCE_REF;
const CONTENT = FUN_KINGDOM_8_MANTRAS_CANONICAL_CONTENT;

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
    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) return json(500, { error: roleErr.message });
    if (!roleRow) return json(403, { error: "Forbidden — admin role required" });

    const pushResult = await pushToAngelKnowledge(
      {
        source: SOURCE,
        source_ref: SOURCE_REF,
        title: "8 Câu Thần Chú Fun Kingdom (8 Divine Mantras)",
        content: CONTENT,
        language: "vi",
        folder: "fun_kingdom/core",
        metadata: {
          category: "core_scripture",
          priority: "highest",
          immutable: true,
        },
      },
      { chunk_now: true, verify: true },
    );

    const statusResult = await getAngelKnowledgeStatus(SOURCE, [SOURCE_REF]);

    return json(200, {
      ok: pushResult.ok,
      push: pushResult,
      status: statusResult,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[angel-seed-mantras]", msg);
    return json(500, { error: msg });
  }
});
