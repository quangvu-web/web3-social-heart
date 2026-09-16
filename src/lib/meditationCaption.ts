// Shared caption builder — mirrors supabase/functions/meditation-broadcast/index.ts
export type MeditationCfgLike = {
  topic_vi?: string;
  topic_en?: string;
  zoom_url?: string;
  zoom_id?: string;
  zoom_pw?: string;
  youtube_community_url?: string;
  youtube_happy_url?: string;
  facebook_url?: string;
  funprofile_url?: string;
  telegram_url?: string;
  x_url?: string;
};

export function escapeHtml(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildMeditationCaption(cfg: MeditationCfgLike): string {
  const lines: string[] = [];
  lines.push('✨⚡️🌟 🌟 <b>ZOOM THIỀN MỘT THÁNG - SÁNG MỘT ĐỜI ĐÃ MỞ!</b> 🌟🌟⚡️✨');
  lines.push('');
  lines.push('🌞 <b>THỜI GIAN:</b> 05H • 12H • 20H hằng ngày');
  lines.push(`💖 <b>Chủ đề:</b> ${escapeHtml(cfg.topic_vi || '')}`);
  if (cfg.topic_en) lines.push(`🌐 <i>${escapeHtml(cfg.topic_en)}</i>`);
  lines.push('');
  lines.push('📍 <b>Zoom:</b> 🕉 <i>(5h-7h AM, 12h-2h PM, 8h-10h PM giờ VN)</i>');
  if (cfg.zoom_url) lines.push(`🔗 <a href="${cfg.zoom_url}">Vào phòng Zoom ngay!</a>`);
  lines.push(`🆔 ID: ${escapeHtml(cfg.zoom_id || '')} | 🔑 PW: ${escapeHtml(cfg.zoom_pw || '')}`);
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

// Render Telegram-style HTML (subset) to safe React-ish HTML string
// Supports <b>, <i>, <a href="">. Other tags already escaped upstream.
export function captionToPreviewHtml(caption: string): string {
  // Caption already contains intentional <b>/<i>/<a> tags AND escaped user text.
  // For preview we just convert newlines to <br/>.
  return caption.replace(/\n/g, '<br/>');
}

// ---- Tiptap <-> Telegram HTML converters ------------------------------------
// Telegram allowed inline tags: <b>, <i>, <a href>. Lines separated by \n.
// Tiptap StarterKit emits <p>, <strong>, <em>, plus link mark <a>.

export function telegramCaptionToTiptapHtml(caption: string): string {
  const lines = (caption ?? '').split('\n');
  return lines
    .map((raw) => {
      // Normalize Telegram tags to Tiptap-friendly ones.
      const line = raw
        .replace(/<b>/gi, '<strong>')
        .replace(/<\/b>/gi, '</strong>')
        .replace(/<i>/gi, '<em>')
        .replace(/<\/i>/gi, '</em>');
      return line.trim() === '' ? '<p></p>' : `<p>${line}</p>`;
    })
    .join('');
}

function tgEscapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function tiptapHtmlToTelegramCaption(html: string): string {
  if (typeof window === 'undefined' || !html) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="__root">${html}</div>`, 'text/html');
  const root = doc.getElementById('__root');
  if (!root) return '';

  const serializeInline = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return tgEscapeText(node.textContent ?? '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const inner = Array.from(el.childNodes).map(serializeInline).join('');
    if (tag === 'strong' || tag === 'b') return inner ? `<b>${inner}</b>` : '';
    if (tag === 'em' || tag === 'i') return inner ? `<i>${inner}</i>` : '';
    if (tag === 'a') {
      const href = (el.getAttribute('href') || '').replace(/"/g, '&quot;');
      return href ? `<a href="${href}">${inner}</a>` : inner;
    }
    if (tag === 'br') return '\n';
    return inner;
  };

  const lines: string[] = [];
  Array.from(root.children).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'p' || tag === 'div') {
      const content = Array.from(el.childNodes).map(serializeInline).join('');
      content.split('\n').forEach((l) => lines.push(l));
    } else {
      serializeInline(el).split('\n').forEach((l) => lines.push(l));
    }
  });
  // Trim trailing empty lines only.
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}
