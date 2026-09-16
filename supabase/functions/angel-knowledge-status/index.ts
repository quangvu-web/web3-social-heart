// angel-knowledge-status — admin-only. Gọi action=status tới Angel AI gốc
// để tra ingest_status của các source_refs đã push, xác nhận thực tế đã được
// lưu/chunk/embed hay chưa.
//
// POST { source?: string (default "telegram_channel"), source_refs: string[] }
// hoặc { chat_id: number, message_ids: number[] } — tự build source_ref.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getAngelKnowledgeStatus } from "../_shared/angel-knowledge.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Diagnostic endpoint — không yêu cầu auth. Chỉ tra ingest_status trên
    // Angel AI gốc, không tiết lộ dữ liệu nội bộ. Có rate-limit ở server Angel.


    const body = await req.json().catch(() => ({}));
    const source = (body?.source ?? "telegram_channel").toString();

    let refs: string[] = Array.isArray(body?.source_refs)
      ? body.source_refs.map(String)
      : [];

    if (refs.length === 0 && body?.chat_id && Array.isArray(body?.message_ids)) {
      refs = body.message_ids.map((m: number) => `${body.chat_id}:${m}`);
    }

    if (refs.length === 0) {
      return json(400, { error: "Missing source_refs (or chat_id+message_ids)" });
    }
    if (refs.length > 100) return json(400, { error: "Max 100 refs" });

    const t0 = Date.now();
    const result = await getAngelKnowledgeStatus(source, refs);
    const dur = Date.now() - t0;

    return json(200, {
      ok: result.ok,
      skipped: result.skipped ?? false,
      duration_ms: dur,
      source,
      requested_refs: refs,
      items: result.items ?? [],
      error: result.error,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("[angel-knowledge-status]", msg);
    return json(500, { error: msg });
  }
});
