// Angel AI — Web chat history sync (cross-device)
// GET  → trả lịch sử chat gần đây (mặc định 50 tin) của user hiện tại
// DELETE → xoá toàn bộ lịch sử của user hiện tại

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (!supabaseUrl || !supabaseAnonKey) return json(500, { error: 'Env not configured' });

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) return json(401, { error: 'Unauthorized' });

    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? 50)));

    if (req.method === 'GET') {
      const { data, error } = await supabaseUser
        .from('angel_web_chat_history')
        .select('id, role, content, created_at')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return json(500, { error: error.message });
      // trả về theo thứ tự thời gian tăng dần cho UI
      const messages = (data ?? []).reverse();
      return json(200, { messages });
    }

    if (req.method === 'DELETE') {
      const { error } = await supabaseUser
        .from('angel_web_chat_history')
        .delete()
        .eq('user_id', userData.user.id);
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[angel-web-history]', msg);
    return json(500, { error: msg });
  }
});
