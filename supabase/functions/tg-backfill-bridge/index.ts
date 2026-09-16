// Temporary bridge để sandbox chạy gramjs lấy được secret + đọc/ghi progress vào DB.
// Sau khi ingest xong sẽ xoá function này + các secret TELEGRAM_USER_*.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Bridge tạm thời cho backfill lịch sử. Function này sẽ bị xoá sau khi ingest xong.
  const EXPECTED = 'br_' + '7JvLKXh-VkKLnCHaN2kPmtvnzJyADx2Q4TBXlQl9QR9BElkV';
  const auth = req.headers.get('x-bridge-token') || '';
  if (auth !== EXPECTED) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || '';

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    if (action === 'config') {
      return json({
        api_id: Deno.env.get('TELEGRAM_USER_API_ID') || '',
        api_hash: Deno.env.get('TELEGRAM_USER_API_HASH') || '',
        phone: Deno.env.get('TELEGRAM_USER_PHONE') || '',
        otp: Deno.env.get('TELEGRAM_USER_OTP') || '',
        password: Deno.env.get('TELEGRAM_USER_2FA_PASSWORD') || '',
        angel_ingest_key: Deno.env.get('ANGEL_KNOWLEDGE_INGEST_KEY') || '',
      });
    }

    if (action === 'state_get') {
      const body = await req.json().catch(() => ({}));
      const chat_id = Number(body.chat_id);
      const { data, error } = await supa
        .from('telegram_history_backfill')
        .select('*')
        .eq('chat_id', chat_id)
        .maybeSingle();
      if (error) throw error;
      return json({ state: data });
    }

    if (action === 'state_upsert') {
      const body = await req.json();
      const row = {
        chat_id: Number(body.chat_id),
        chat_title: body.chat_title ?? null,
        chat_username: body.chat_username ?? null,
        session_string: body.session_string ?? null,
        phone_code_hash: body.phone_code_hash ?? null,
        cursor_min_id: body.cursor_min_id ?? null,
        total_ingested: body.total_ingested ?? null,
        total_seen: body.total_seen ?? null,
        status: body.status ?? null,
        last_error: body.last_error ?? null,
        updated_at: new Date().toISOString(),
      };
      // Strip null keys so upsert doesn't overwrite existing values with null
      const clean: Record<string, unknown> = { chat_id: row.chat_id };
      for (const [k, v] of Object.entries(row)) {
        if (v !== null && v !== undefined) clean[k] = v;
      }
      const { error } = await supa
        .from('telegram_history_backfill')
        .upsert(clean, { onConflict: 'chat_id' });
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
