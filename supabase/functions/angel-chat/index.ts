import { createClient } from 'npm:@supabase/supabase-js@2';
import { callAngelCore, AngelCoreError, getAngelProvider } from '../_shared/angel-core.ts';
import {
  OFFICIAL_FACTS,
  ANTI_HALLUCINATION_RULE,
  SCOPE_EXPANSION_RULE,
  PRONOUN_SUBJECT_RULE,
  NARRATIVE_CHARACTER_VOICE_RULE,
  RICH_FORMAT_RULE,
  RESPONSE_LENGTH_RULE,
  LONG_INPUT_HANDLING_RULE,
  LIGHT_LANGUAGE_RULE,
  SEEDING_CONTEXT_FIDELITY_RULE,
  SEED_PHRASE_WARNING_DISCIPLINE_RULE,
  WEB_PERSONA_PROMPT,
  WEB_LANGUAGE_MIRROR_RULE,
  buildResponseModeHint,
  loadAngelRuleOverrides,
} from '../_shared/angel-facts.ts';
import { buildContextBridgedQuery, CONTEXT_CONTINUITY_RULE, shouldBridge } from '../_shared/angel-context-bridge.ts';
import { logAngelConversation } from '../_shared/telegram-community.ts';
import {
  buildMemoryContextMessage,
  getAngelMemory,
  getAngelMemorySettings,
  isMemoryEnabledForChannel,
  scheduleFactExtraction,
} from '../_shared/angel-memory.ts';
import {
  buildSummaryPrefix,
  getRollingSummarySettings,
  loadRollingSummary,
  scheduleRollingSummaryUpdate,
} from '../_shared/angel-rolling-summary.ts';


import { withUsage } from '../_shared/track-cloud-usage.ts';
import { enforceAngelVietnamesePronounContract } from '../_shared/angel/pronouns.ts';
import { enforceGuestRate, validGuestId, guestImageIntent, GUEST_IMAGE_MESSAGE, GUEST_LIMIT_MESSAGE, GUEST_PUBLIC_POLICY } from './guest.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};



type ChatMessage = { role: 'user' | 'assistant'; content: string };
type AngelChatRequest = { messages: ChatMessage[]; guest?: boolean; guest_id?: string };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(withUsage('angel-chat', 'Angel AI · DM', async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const provider = getAngelProvider();
    if (!supabaseUrl || !supabaseAnonKey) {
      return json(500, { error: 'Supabase env not configured' });
    }

    const body = (await req.json()) as AngelChatRequest;
    // Guest admission is separate from getUser; no user history, memory, RAG or image router.
    if (body.guest === true) {
      const suppliedKey = req.headers.get('apikey');
      const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
      if (suppliedKey !== supabaseAnonKey && (!publishableKey || suppliedKey !== publishableKey)) {
        // Projects may have multiple active public keys after a remix/key rotation.
        // Verify alternate public keys against this project's Auth gateway, never
        // trust an unverified decoded JWT as authorization or accept a service key.
        let publicCandidate = suppliedKey?.startsWith('sb_publishable_') ?? false;
        try {
          const payload = suppliedKey?.split('.')[1];
          if (payload) publicCandidate = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon';
        } catch { publicCandidate = false; }
        if (!suppliedKey || !publicCandidate) return json(401, { error: 'Unauthorized guest' });
        const verification = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          headers: { apikey: suppliedKey }, signal: AbortSignal.timeout(5000),
        });
        if (!verification.ok) return json(401, { error: 'Unauthorized guest' });
      }
      if (!validGuestId(body.guest_id)) return json(400, { error: 'Invalid guest ID' });
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!serviceKey) return json(503, { error: 'Guest chat temporarily unavailable' });
      const guestMessages = (Array.isArray(body.messages) ? body.messages : []).slice(-20)
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content.slice(0, 1500).trim() }))
        .filter(m => m.content);
      const last = guestMessages.at(-1);
      if (!last || last.role !== 'user') return json(400, { error: 'Last message must be from user' });
      const rateClient = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '';
      const decision = await enforceGuestRate(rateClient, body.guest_id, ip);
      console.log('[angel-chat] guest_admission', { decision });
      if (decision === 'unavailable') return json(503, { error: 'Bé ơi, Angel chưa kiểm tra được giới hạn. Bé thử lại sau nhé 💛\nAngel cannot verify the chat limit right now. Please try again later 💛' });
      if (decision === 'limited') return json(429, { error: GUEST_LIMIT_MESSAGE });
      if (guestImageIntent(last.content)) return json(200, { reply: GUEST_IMAGE_MESSAGE });
      try {
        // Text-only gateway, NOT the FUN Core router (which can create images or search knowledge).
        const result = await callAngelCore({
          forceProvider: 'lovable', model: 'google/gemini-2.5-flash', max_tokens: 1000,
          messages: [
            { role: 'system', content: OFFICIAL_FACTS },
            { role: 'system', content: GUEST_PUBLIC_POLICY },
            ...guestMessages,
          ],
        });
        if (!result.text) return json(502, { error: 'Angel has no reply yet. Please try again 💛' });
        console.log('[angel-chat] guest_reply', { provider: result.provider });
        return json(200, { reply: enforceAngelVietnamesePronounContract(result.text) });
      } catch {
        console.warn('[angel-chat] guest_reply_failed');
        return json(502, { error: 'Bé ơi, Angel chưa trả lời được. Bé thử lại sau nhé 💛\nAngel cannot reply right now. Please try again later 💛' });
      }
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) return json(401, { error: 'Unauthorized' });

    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length === 0) return json(400, { error: 'Missing messages' });

    // Sanitize: keep only role+content, trim, cap length
    const cleaned: ChatMessage[] = [];
    for (const m of messages.slice(-20)) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
      const content = String(m.content ?? '').slice(0, 4000).trim();
      if (!content) continue;
      cleaned.push({ role: m.role, content });
    }
    if (cleaned.length === 0) return json(400, { error: 'Empty messages' });
    if (cleaned[cleaned.length - 1].role !== 'user') {
      return json(400, { error: 'Last message must be from user' });
    }

    let reply = '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const adminClient = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : null;
    const lastUserMsg = cleaned[cleaned.length - 1]?.content ?? '';
    const t0 = Date.now();
    const userEmail = userData.user.email ?? null;
    // Các cấu hình độc lập nhau — đọc song song để giảm thời gian chờ trước FUN Core.
    const [_ruleOverrides, _memSettings, _rollingSettings] = await Promise.all([
      loadAngelRuleOverrides(adminClient),
      getAngelMemorySettings(adminClient),
      getRollingSummarySettings(adminClient, 'web'),
    ]);

    // ANGEL MEMORY — nạp trí nhớ dài hạn cho bé (theo web user id) nếu admin bật
    const _webMemOn = isMemoryEnabledForChannel(_memSettings, 'web');
    const [_memoryRow, _rollingRow] = await Promise.all([
      _webMemOn ? getAngelMemory(adminClient, { channel: 'web', userKey: userData.user.id }) : Promise.resolve(null),
      _rollingSettings.enabled
        ? loadRollingSummary(adminClient, { channel: 'web', scopeKey: userData.user.id })
        : Promise.resolve(null),
    ]);
    const memoryRow = _memoryRow;
    const memoryMsg = _webMemOn ? buildMemoryContextMessage(memoryRow) : null;

    // ROLLING SUMMARY (web) — nếu bật, prepend tóm tắt hội thoại cũ
    const _summaryMsg = buildSummaryPrefix(_rollingRow);


    // Cross-device: lưu tin nhắn user lên server
    if (adminClient) {
      adminClient
        .from('angel_web_chat_history')
        .insert({ user_id: userData.user.id, role: 'user', content: lastUserMsg })
        .then(({ error }) => { if (error) console.warn('[angel-chat] persist user msg', error.message); });
    }

    // CONTEXT BRIDGE — nếu user chỉ trả lời xác nhận ngắn ("dạ có", "vâng"...)
    // và turn assistant trước có câu hỏi mở → rewrite last user msg để RAG bám đúng chủ đề.
    const bridgedMessages: typeof cleaned = cleaned.slice();
    if (bridgedMessages.length >= 2 && shouldBridge(lastUserMsg)) {
      const bridged = buildContextBridgedQuery(lastUserMsg, bridgedMessages.slice(0, -1));
      if (bridged) {
        console.log(`[angel-chat] context-bridge rewrote "${lastUserMsg.slice(0, 40)}"`);
        bridgedMessages[bridgedMessages.length - 1] = { role: 'user', content: bridged };
      }
    }

    try {
      const result = await callAngelCore({
        model: provider === 'lovable' ? 'google/gemini-2.5-flash' : undefined,
        messages: [
          { role: 'system', content: WEB_PERSONA_PROMPT },

          { role: 'system', content: PRONOUN_SUBJECT_RULE },
          { role: 'system', content: NARRATIVE_CHARACTER_VOICE_RULE },
          { role: 'system', content: OFFICIAL_FACTS },
          ...(memoryMsg ? [memoryMsg] : []),
          ...(_summaryMsg ? [_summaryMsg] : []),

          { role: 'system', content: SCOPE_EXPANSION_RULE },
          { role: 'system', content: ANTI_HALLUCINATION_RULE },
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'Hello ✨ Angel is here for you. How can Angel help today? 💛' },
          { role: 'user', content: 'chào Angel' },
          { role: 'assistant', content: 'Chào bé yêu ✨ Angel ở đây rồi. Bé cần Angel hỗ trợ gì hôm nay nè? 💛' },
          { role: 'user', content: 'tình yêu thuần khiết là gì?' },
          { role: 'assistant', content: 'Bé ơi ✨ Tình yêu thuần khiết là tình yêu không điều kiện — trao đi mà không chờ nhận lại, không phán xét, không sở hữu. Nó khởi lên từ sự bình an nội tâm, khi trái tim bé mở rộng và cảm nhận sự kết nối với chính mình và mọi người xung quanh 💛 Bé thử đặt tay lên ngực, hít thở sâu, và cảm nhận thứ tình yêu đó đang có sẵn trong bé nhé 🌟' },
          // LANGUAGE + SCOPE + ANTI-HALLUCINATION + LENGTH + LIGHT LANGUAGE đặt LAST → strongest recency weight
          { role: 'system', content: WEB_LANGUAGE_MIRROR_RULE },
          { role: 'system', content: PRONOUN_SUBJECT_RULE },
          { role: 'system', content: NARRATIVE_CHARACTER_VOICE_RULE },
          { role: 'system', content: SCOPE_EXPANSION_RULE },
          { role: 'system', content: ANTI_HALLUCINATION_RULE },
          { role: 'system', content: RICH_FORMAT_RULE },
          { role: 'system', content: RESPONSE_LENGTH_RULE },
          { role: 'system', content: LONG_INPUT_HANDLING_RULE },
          { role: 'system', content: LIGHT_LANGUAGE_RULE },
          { role: 'system', content: SEEDING_CONTEXT_FIDELITY_RULE },
          { role: 'system', content: SEED_PHRASE_WARNING_DISCIPLINE_RULE },
          { role: 'system', content: CONTEXT_CONTINUITY_RULE },
          { role: 'system', content: buildResponseModeHint(lastUserMsg) },

          ...bridgedMessages,
        ],
      });
      reply = enforceAngelVietnamesePronounContract(result.text);
      void logAngelConversation(adminClient, {
        triggerSource: 'web_chat',
        source: 'web_chat',
        webUserId: userData.user.id,
        username: userEmail,
        fullName: (userData.user.user_metadata as any)?.full_name ?? null,
      }, {
        userMessage: lastUserMsg,
        botReply: reply,
        provider: result.provider,
        latencyMs: Date.now() - t0,
      }).catch((err) => console.warn('[angel-chat] conversation log failed', err));

      // Cross-device: lưu reply lên server
      if (adminClient) {
        adminClient
          .from('angel_web_chat_history')
          .insert({ user_id: userData.user.id, role: 'assistant', content: reply })
          .then(({ error }) => { if (error) console.warn('[angel-chat] persist reply', error.message); });
      }

      // ANGEL MEMORY — fire-and-forget fact extraction (mỗi 5 turn 1 lần) — chỉ khi admin bật
      if (_webMemOn) {
        scheduleFactExtraction(adminClient, {
          channel: 'web',
          userKey: userData.user.id,
          displayName: (userData.user.user_metadata as any)?.full_name ?? userEmail ?? null,
          userMessage: lastUserMsg,
          botReply: reply,
        }).catch((err) => console.warn('[angel-chat] memory extract failed', err));
      }

      // ROLLING SUMMARY (web) — cập nhật background nếu vượt ngưỡng
      if (_rollingSettings.enabled) {
        scheduleRollingSummaryUpdate(adminClient, {
          channel: 'web',
          scopeKey: userData.user.id,
          history: [...cleaned, { role: 'assistant', content: reply }],
          settings: _rollingSettings,
        }).catch((err) => console.warn('[angel-chat] rolling summary failed', err));
      }

    } catch (e) {
      await logAngelConversation(adminClient, {
        triggerSource: 'web_chat',
        source: 'web_chat',
        webUserId: userData.user.id,
        username: userEmail,
      }, {
        userMessage: lastUserMsg,
        latencyMs: Date.now() - t0,
        error: e instanceof Error ? e.message : String(e),
      });
      if (e instanceof AngelCoreError) {
        return json(e.status === 429 ? 429 : 502, { error: e.message });
      }
      throw e;
    }

    if (!reply) return json(502, { error: 'Empty AI response' });

    return json(200, { reply });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[angel-chat]', msg);
    return json(500, { error: msg });
  }
}));
