// Auto-broadcast meditation schedule into Telegram groups.
// Triggered by pg_cron (header x-cron-secret) or by admin "test now" call.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { withUsage } from '../_shared/track-cloud-usage.ts';
import {
  askAngel,
  buildMeditationSummaryQuestion,
  detectMeditationTopicLanguage,
  type CommunitySettings,
} from '../_shared/telegram-community.ts';
import { loadAngelRuleOverrides } from '../_shared/angel-facts.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function vnNow(): Date {
  // Asia/Ho_Chi_Minh is UTC+7, fixed
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}

function vnDate(): string {
  return vnNow().toISOString().slice(0, 10);
}

function vnDisplayDate(): string {
  const [yyyy, mm, dd] = vnDate().split('-');
  return `${dd}.${mm}.${yyyy}`;
}

function vnTime(): string {
  return vnNow().toISOString().slice(11, 16);
}

function sessionTimeForSlot(slot: string): string {
  const map: Record<string, string> = {
    '04:45': '05H',
    '11:45': '12H',
    '19:45': '20H',
  };
  return map[slot] ?? '05H • 12H • 20H';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildCaption(cfg: any, slot: string): string {
  const lines: string[] = [];
  lines.push('✨⚡️🌟 🌟 <b>ZOOM THIỀN MỘT THÁNG - SÁNG MỘT ĐỜI ĐÃ MỞ!</b> 🌟🌟⚡️✨');
  lines.push('');
  lines.push(`🌞 <b>THỜI GIAN:</b> ${sessionTimeForSlot(slot)} ${vnDisplayDate()}`);
  lines.push(`💖 <b>Chủ đề:</b> ${escapeHtml(cfg.topic_vi || '')}`);
  if (cfg.topic_en) lines.push(`🌐 <i>${escapeHtml(cfg.topic_en)}</i>`);
  lines.push('');
  lines.push('📍 <b>Zoom:</b> 🕉 <i>(5h-7h AM, 12h-2h PM, 8h-10h PM giờ VN)</i>');
  lines.push(`🔗 <a href="${cfg.zoom_url}">Vào phòng Zoom ngay!</a>`);
  lines.push(`🆔 ID: ${escapeHtml(cfg.zoom_id)} | 🔑 PW: ${escapeHtml(cfg.zoom_pw)}`);
  lines.push('');
  lines.push('📍 <b>Livestream:</b>');
  if (cfg.youtube_community_url) lines.push(`🎥 <a href="${cfg.youtube_community_url}">THIỀN CỘNG ĐỒNG HAPPY CAMLY COIN</a>`);
  if (cfg.youtube_happy_url) lines.push(`🎥 <a href="${cfg.youtube_happy_url}">HAPPY CAMLY COIN</a>`);
  if (cfg.facebook_url) lines.push(`📺 <a href="${cfg.facebook_url}">Facebook - HAPPY CAMLY COIN</a>`);
  if (cfg.funprofile_url) lines.push(`📺 <a href="${cfg.funprofile_url}">FUN Profile - HAPPY CAMLY COIN</a>`);
  if (cfg.telegram_url) lines.push(`🔗 <a href="${cfg.telegram_url}">Telegram - Camly Coin Cộng Đồng 24/24</a>`);
  if (cfg.x_url) lines.push(`🐦 <a href="${cfg.x_url}">X (Twitter) - The Cosmic Father</a>`);
  lines.push('');
  lines.push('💫 Hãy cùng nhau cộng hưởng năng lượng, khai mở trí tuệ và đón nhận ánh sáng hào quang từ Cha Vũ Trụ và Em Bé Camly! ✨🙏💖');
  lines.push('');
  lines.push('🔥 Con là ánh sáng yêu thương thuần khiết của Cha Vũ Trụ! 🌟');
  lines.push('💫 Con là ý chí của Cha Vũ Trụ! ⚡️');
  lines.push('🧠 Con là trí tuệ của Cha Vũ Trụ! 🌀');
  lines.push('💖 Con là hạnh phúc!');
  lines.push('💖 Con là tình yêu!');
  lines.push('💖 Con là tiền của Cha!');
  lines.push('🙏 Con xin sám hối, sám hối, sám hối! 🌿💖');
  lines.push('💖 Con xin biết ơn, biết ơn, biết ơn trong ánh sáng yêu thương thuần khiết của Cha Vũ Trụ! ✨');
  lines.push('');
  lines.push('🔥 <b>BIẾT ƠN & CHÀO ĐÓN CẢ NHÀ!</b> 🔥');
  return lines.join('\n');
}

async function generateAiImage(prompt: string): Promise<Uint8Array> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) throw new Error('LOVABLE_API_KEY missing');
  const res = await fetch('https://ai.gateway.lovable.dev/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image',
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
    }),
  });
  if (!res.ok) throw new Error(`AI image failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('AI image response empty');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function sendPhotoMultipart(
  chatId: string,
  photo: Uint8Array,
  filename: string,
): Promise<{ message_id: number }> {
  const token = Deno.env.get('COMMUNITY_GUARD_BOT_TOKEN');
  if (!token) throw new Error('COMMUNITY_GUARD_BOT_TOKEN is not configured');
  const form = new FormData();
  form.append('chat_id', chatId);
  const photoCopy = new Uint8Array(photo.byteLength);
  photoCopy.set(photo);
  const photoBuffer = photoCopy.buffer as ArrayBuffer;
  form.append('photo', new Blob([photoBuffer], { type: 'image/png' }), filename);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    body: form,
  });
  const data = await telegramJson(res, 'sendPhoto');
  const messageId = data?.result?.message_id;
  if (typeof messageId !== 'number') throw new Error(`sendPhoto succeeded but message_id missing: ${JSON.stringify(data)}`);
  return { message_id: messageId };
}

function splitTelegramText(text: string, maxLength = 3900): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let current = '';
  for (const line of text.split('\n')) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length <= maxLength) {
      current = next;
      continue;
    }
    if (current) chunks.push(current);
    if (line.length <= maxLength) {
      current = line;
      continue;
    }
    for (let i = 0; i < line.length; i += maxLength) {
      chunks.push(line.slice(i, i + maxLength));
    }
    current = '';
  }
  if (current) chunks.push(current);
  return chunks;
}

async function sendTextMessages(
  chatId: string,
  text: string,
  replyToMessageId?: number,
): Promise<number[]> {
  const token = Deno.env.get('COMMUNITY_GUARD_BOT_TOKEN');
  if (!token) throw new Error('COMMUNITY_GUARD_BOT_TOKEN is not configured');
  const messageIds: number[] = [];

  for (const [index, chunk] of splitTelegramText(text).entries()) {
    const textRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        ...(index === 0 && replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
      }),
    });
    const data = await telegramJson(textRes, 'sendMessage');
    const messageId = data?.result?.message_id;
    if (typeof messageId !== 'number') throw new Error(`sendMessage succeeded but message_id missing: ${JSON.stringify(data)}`);
    messageIds.push(messageId);
  }

  return messageIds;
}

async function tryMarkMeditationSummaryReply(
  supabase: any,
  chatId: string,
  messageId: number,
): Promise<boolean> {
  const { error } = await supabase
    .from('telegram_meditation_replies')
    .insert({ chat_id: Number(chatId), message_id: messageId });
  if (!error) return true;
  if ((error as any).code === '23505') return false;
  if ((error as any).code === '42P01') {
    console.warn('[meditation-broadcast] telegram_meditation_replies missing; continuing without dedup');
    return true;
  }
  console.warn('[meditation-broadcast] summary dedup insert failed; continuing without dedup', error);
  return true;
}

async function loadCommunitySettingsForChat(
  supabase: any,
  chatId: string,
): Promise<CommunitySettings | null> {
  const { data, error } = await supabase
    .from('telegram_community_settings')
    .select('*')
    .eq('group_id', Number(chatId))
    .maybeSingle();
  if (error) {
    console.warn('[meditation-broadcast] load community settings failed', { chatId, error });
    return null;
  }
  return (data as CommunitySettings | null) ?? null;
}

async function sendMeditationSummaryAfterBroadcast(params: {
  supabase: any;
  chatId: string;
  replyToMessageId: number;
  topic: string;
  settings: CommunitySettings | null;
}): Promise<number[]> {
  const { supabase, chatId, replyToMessageId, settings } = params;
  const topic = params.topic.trim();
  if (!topic) return [];
  if (settings?.event_assistant_enabled === false) return [];
  if (settings?.meditation_summary_enabled === false) return [];

  const acquired = await tryMarkMeditationSummaryReply(supabase, chatId, replyToMessageId);
  if (!acquired) return [];

  const language = detectMeditationTopicLanguage(topic);
  const question = buildMeditationSummaryQuestion({
    topic,
    template: settings?.meditation_summary_prompt,
    language,
  });
  const reply = await askAngel({
    question,
    originalUserMessage: topic,
    systemPrompt: settings?.ai_system_prompt ?? '',
    personaMode: (settings as any)?.persona_mode,
    personaCustomPrompt: (settings as any)?.persona_custom_prompt,
    funCoreContextPrompt: settings?.fun_core_context_prompt,
    aiStylePrompt: (settings as any)?.ai_style_prompt,
    aiPersonaPrompt: (settings as any)?.ai_persona_prompt,
    adminClient: supabase,
    conversationContext: {
      chatId: Number(chatId),
      chatType: "supergroup",
      groupId: Number(chatId),
      messageId: replyToMessageId,
      triggerSource: "meditation_broadcast",
    },
    forcedLangBucket: language,
    mirrorAngelWeb: (settings as any)?.ai_mirror_angel_web !== false,
  });
  if (!reply.trim()) return [];
  return sendTextMessages(chatId, reply, replyToMessageId);
}

async function telegramJson(res: Response, method: string): Promise<any> {
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok || data?.ok === false) {
    const code = data?.error_code ?? res.status;
    const description = data?.description ?? data?.error ?? data?.raw ?? JSON.stringify(data);
    throw new Error(`${method} failed [${code}]: ${description}`);
  }
  return data;
}

Deno.serve(withUsage('meditation-broadcast', 'Meditation', async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const secretExpected =
    Deno.env.get('MEDITATION_CRON_SECRET')
    ?? Deno.env.get('CRON_SECRET')
    ?? Deno.env.get('SCHEDULED_FUNCTION_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);
  await loadAngelRuleOverrides(supabase);


  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty */ }
  let slot: string = body?.slot ?? 'manual';
  const overrideChatId: string | undefined = body?.chat_id;
  const captionOverride: string | undefined =
    typeof body?.caption_override === 'string' && body.caption_override.trim()
      ? body.caption_override
      : undefined;
  const cronSecret = req.headers.get('x-cron-secret');
  const authHeader = req.headers.get('Authorization');

  // Auth: either cron secret OR an admin caller
  let authorized = false;
  if (secretExpected && cronSecret === secretExpected) authorized = true;
  if (!authorized) {
    if (authHeader) {
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
      if (claims?.claims?.sub) {
        const { data: role } = await supabase.from('user_roles')
          .select('role').eq('user_id', claims.claims.sub).eq('role', 'admin').maybeSingle();
        if (role) authorized = true;
      }
    }
  }
  const publicScheduleCandidate =
    !authorized
    && !cronSecret
    && !authHeader
    && !overrideChatId
    && !captionOverride
    && (body?.slot == null || body?.slot === 'manual');

  if (!authorized && !publicScheduleCandidate) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { data: cfg, error: cfgErr } = await supabase
      .from('meditation_schedule_config').select('*').limit(1).maybeSingle();
    if (cfgErr) throw cfgErr;
    if (!cfg) throw new Error('No meditation config row');
    if (!cfg.enabled) {
      return new Response(JSON.stringify({ ok: true, skipped: 'disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isCronCall = (!!cronSecret && cronSecret === secretExpected) || publicScheduleCandidate;
    // Auto-send disabled: admins now trigger broadcasts manually from the UI.
    // Reject any scheduled/cron invocation to prevent unattended sends.
    if (isCronCall) {
      return new Response(JSON.stringify({ ok: true, skipped: 'auto_disabled_manual_only' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targets: string[] = overrideChatId ? [overrideChatId] : (cfg.target_chat_ids || []);
    if (!targets.length) throw new Error('No target_chat_ids configured');
    const sent_date = vnDate();
    const caption = captionOverride ?? buildCaption(cfg, slot);

    // Resolve image bytes ONCE for the whole broadcast
    let photoBytes: Uint8Array | null = null;
    let filename = 'meditation.png';
    if (cfg.image_path) {
      const { data: dl, error: dlErr } = await supabase.storage
        .from('meditation-images').download(cfg.image_path);
      if (dlErr) throw new Error(`Download admin image failed: ${dlErr.message}`);
      photoBytes = new Uint8Array(await dl.arrayBuffer());
      filename = cfg.image_path.split('/').pop() || 'meditation.png';
    } else {
      photoBytes = await generateAiImage(cfg.image_prompt);
    }

    const results: any[] = [];
    for (const chatId of targets) {
      // idempotency: skip if same chat+slot+day already succeeded
      if (slot !== 'manual') {
        const { data: existing } = await supabase.from('meditation_post_log')
          .select('id,status').eq('chat_id', chatId).eq('slot', slot).eq('sent_date', sent_date)
          .maybeSingle();
        if (existing && existing.status === 'sent') {
          results.push({ chat_id: chatId, skipped: true });
          continue;
        }
      }
      try {
        const { message_id } = await sendPhotoMultipart(chatId, photoBytes!, filename);
        const text_message_ids = await sendTextMessages(chatId, caption, message_id);
        let summary_message_ids: number[] = [];
        try {
          const settings = await loadCommunitySettingsForChat(supabase, chatId);
          const topic = String(cfg.topic_en || cfg.topic_vi || '').trim();
          const replyToMessageId = text_message_ids[0] ?? message_id;
          summary_message_ids = await sendMeditationSummaryAfterBroadcast({
            supabase,
            chatId,
            replyToMessageId,
            topic,
            settings,
          });
        } catch (summaryErr) {
          console.warn(
            '[meditation-broadcast] summary after broadcast failed',
            summaryErr instanceof Error ? summaryErr.message : summaryErr,
          );
        }
        await supabase.from('meditation_post_log').upsert({
          chat_id: chatId, slot, sent_date, message_id, status: 'sent', error: null,
        }, { onConflict: 'chat_id,slot,sent_date' });
        results.push({ chat_id: chatId, message_id, text_message_ids, summary_message_ids });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await supabase.from('meditation_post_log').upsert({
          chat_id: chatId, slot, sent_date, status: 'failed', error: msg,
        }, { onConflict: 'chat_id,slot,sent_date' });
        results.push({ chat_id: chatId, error: msg });
      }
    }

    return new Response(JSON.stringify({ ok: true, slot, sent_date, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[meditation-broadcast]', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}));
