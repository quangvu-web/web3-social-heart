import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callTelegram(method: string, body: Record<string, unknown>) {
  const token = Deno.env.get("COMMUNITY_GUARD_BOT_TOKEN");
  if (!token) return { ok: false, status: 500, data: { error: "no token" } };
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data?.ok !== false, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: rows, error } = await supabase
    .from("telegram_scheduled_deletions")
    .select("chat_id, message_id")
    .lte("delete_at", new Date().toISOString())
    .limit(100);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let deleted = 0;
  let removed = 0;
  for (const row of rows ?? []) {
    const r = await callTelegram("deleteMessage", {
      chat_id: row.chat_id,
      message_id: row.message_id,
    });
    // Treat "message can't be deleted" / "message to delete not found" as done
    const desc: string = r.data?.description ?? "";
    const giveUp = r.ok || desc.includes("not found") || desc.includes("can't be deleted") || desc.includes("MESSAGE_ID_INVALID");
    if (r.ok) deleted++;
    if (giveUp) {
      const { error: delErr } = await supabase
        .from("telegram_scheduled_deletions")
        .delete()
        .eq("chat_id", row.chat_id)
        .eq("message_id", row.message_id);
      if (!delErr) removed++;
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: rows?.length ?? 0, deleted, removed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
