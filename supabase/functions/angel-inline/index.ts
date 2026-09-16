import { createClient } from 'npm:@supabase/supabase-js@2';
import { withUsage } from '../_shared/track-cloud-usage.ts';
import { callAngelCore, AngelCoreError, getAngelProvider } from '../_shared/angel-core.ts';
import { OFFICIAL_FACTS, ANTI_HALLUCINATION_RULE, SCOPE_EXPANSION_RULE, PRONOUN_SUBJECT_RULE, NARRATIVE_CHARACTER_VOICE_RULE, RICH_FORMAT_RULE, RESPONSE_LENGTH_RULE, LONG_INPUT_HANDLING_RULE, LIGHT_LANGUAGE_RULE, SEEDING_CONTEXT_FIDELITY_RULE, SEED_PHRASE_WARNING_DISCIPLINE_RULE, WEB_PERSONA_PROMPT, WEB_LANGUAGE_MIRROR_RULE, buildResponseModeHint, loadAngelRuleOverrides } from '../_shared/angel-facts.ts';
import { logAngelConversation } from '../_shared/telegram-community.ts';
import { enforceAngelVietnamesePronounContract } from '../_shared/angel/pronouns.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type AngelInlineRequest = {
  conversation_id: string;
  prompt: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractTextFromCompletion(data: any): string {
  const msg = data?.choices?.[0]?.message;
  if (!msg) return '';
  const c = msg.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    // Some providers return array segments
    return c.map((x) => (typeof x === 'string' ? x : x?.text || '')).join('').trim();
  }
  return '';
}

Deno.serve(withUsage('angel-inline', 'Angel AI · Inline', async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const angelBotUserId = Deno.env.get('ANGEL_BOT_USER_ID');
    const provider = getAngelProvider();

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return json(500, { error: 'Supabase env not configured' });
    }
    if (!angelBotUserId) {
      return json(500, { error: 'ANGEL_BOT_USER_ID not configured' });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) return json(401, { error: 'Unauthorized' });
    const userId = userData.user.id;

    const body = (await req.json()) as AngelInlineRequest;
    const conversationId = body?.conversation_id;
    const prompt = (body?.prompt || '').trim();

    if (!conversationId || !prompt) return json(400, { error: 'Missing conversation_id or prompt' });
    if (prompt.length > 2000) return json(400, { error: 'Prompt too long' });

    // Verify membership
    const { data: participant, error: partErr } = await supabaseAdmin
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .is('left_at', null)
      .maybeSingle();
    if (partErr) return json(500, { error: partErr.message });
    if (!participant) return json(403, { error: 'Not a conversation participant' });

    // Basic rate-limit: 1 request / 5s per user per conversation
    const { data: recent, error: recentErr } = await supabaseAdmin
      .from('messages')
      .select('id, created_at')
      .eq('conversation_id', conversationId)
      .eq('sender_id', angelBotUserId)
      .gte('created_at', new Date(Date.now() - 5000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    if (recentErr) return json(500, { error: recentErr.message });
    if (recent && recent.length > 0) {
      return json(429, { error: 'Rate limited' });
    }

    const t0 = Date.now();
    let reply = '';
    let usedProvider: string | null = null;
    await loadAngelRuleOverrides(supabaseAdmin);
    try {
      const result = await callAngelCore({
        model: provider === 'lovable' ? 'google/gemini-2.5-flash-lite' : undefined,
        max_tokens: 600,
        messages: [
          { role: 'system', content: WEB_PERSONA_PROMPT },
          { role: 'system', content: OFFICIAL_FACTS },
          { role: 'system', content: PRONOUN_SUBJECT_RULE },
          { role: 'system', content: NARRATIVE_CHARACTER_VOICE_RULE },
          { role: 'system', content: SCOPE_EXPANSION_RULE },
          { role: 'system', content: ANTI_HALLUCINATION_RULE },
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'Hello ✨ Angel is here for you. How can Angel help today? 💛' },
          { role: 'user', content: 'chào Angel' },
          { role: 'assistant', content: 'Chào bé yêu ✨ Angel ở đây rồi. Bé cần Angel hỗ trợ gì hôm nay nè? 💛' },
          { role: 'system', content: WEB_LANGUAGE_MIRROR_RULE },

          { role: 'system', content: SCOPE_EXPANSION_RULE },
          { role: 'system', content: PRONOUN_SUBJECT_RULE },
          { role: 'system', content: NARRATIVE_CHARACTER_VOICE_RULE },
          { role: 'system', content: ANTI_HALLUCINATION_RULE },
          { role: 'system', content: RICH_FORMAT_RULE },
          { role: 'system', content: RESPONSE_LENGTH_RULE },
          { role: 'system', content: LONG_INPUT_HANDLING_RULE },
          { role: 'system', content: LIGHT_LANGUAGE_RULE },
          { role: 'system', content: SEEDING_CONTEXT_FIDELITY_RULE },
          { role: 'system', content: SEED_PHRASE_WARNING_DISCIPLINE_RULE },
          { role: 'system', content: buildResponseModeHint(prompt) },

          { role: 'user', content: prompt },
        ],
      });
      reply = enforceAngelVietnamesePronounContract(result.text);
      usedProvider = result.provider;
    } catch (e) {
      await logAngelConversation(supabaseAdmin, {
        triggerSource: 'chat_inline',
        source: 'chat_inline',
        webUserId: userId,
        webConversationId: conversationId,
      }, {
        userMessage: prompt,
        latencyMs: Date.now() - t0,
        error: e instanceof Error ? e.message : String(e),
      });
      if (e instanceof AngelCoreError) {
        return json(e.status === 429 ? 429 : 502, { error: e.message, details: e.details });
      }
      throw e;
    }
    if (!reply) return json(502, { error: 'Empty AI response' });

    await logAngelConversation(supabaseAdmin, {
      triggerSource: 'chat_inline',
      source: 'chat_inline',
      webUserId: userId,
      webConversationId: conversationId,
    }, {
      userMessage: prompt,
      botReply: reply,
      provider: usedProvider,
      latencyMs: Date.now() - t0,
    });


    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: angelBotUserId,
        content: reply,
        media_urls: [],
        reply_to_id: null,
        message_type: 'system',
        metadata: { bot: 'angel', prompt },
      })
      .select('id')
      .single();

    if (insertErr) return json(500, { error: insertErr.message });

    return json(200, { ok: true, message_id: inserted.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[angel-inline]', msg);
    return json(500, { error: msg });
  }
}));
