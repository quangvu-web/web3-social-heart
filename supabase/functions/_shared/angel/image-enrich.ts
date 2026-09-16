// _shared/angel/image-enrich.ts
// Tầng A — Universal Prompt Enrichment cho toàn pipeline vẽ ảnh (P1/P2/P3).
// Trước khi gửi prompt tới model (Angel gốc HOẶC Lovable Gateway), làm giàu
// prompt bằng: art preset theo topic + style/lighting/palette/composition
// + technical quality tags → giúp model bắt đúng ý và ra ảnh sắc nét.
//
// Skip khi:
//   - Prompt user đã ≥ 200 char (đã đủ chi tiết, tránh loãng ý).
//   - Đã có sẵn từ khoá kỹ thuật ("ultra sharp", "8k", "professional design"…).
//   - Flag `image.enrich_prompt` OFF.

export type ArtTopic =
  | "logo"
  | "cosmos"
  | "mandala"
  | "meditation"
  | "lightbeing"
  | "portrait"
  | "landscape"
  | "architecture"
  | "poster"
  | "animal"
  | "generic";

interface ArtPreset {
  topic: ArtTopic;
  match: RegExp;
  style: string;      // Đặc tả style/composition riêng cho topic.
  lighting: string;   // Ánh sáng đặc trưng.
  palette: string;    // Bảng màu gợi ý.
}

const PRESETS: ArtPreset[] = [
  {
    topic: "logo",
    match: /(logo|biểu tượng|emblem|badge|monogram|wordmark|brand mark)/i,
    style: "clean vector logo, symmetrical geometric composition, centered emblem on plain background, crisp edges, minimal negative space, print-ready",
    lighting: "even studio lighting, subtle inner glow rim light",
    palette: "rich luminous gold, pearl white, deep cosmic navy accents",
  },
  {
    topic: "cosmos",
    match: /(cosmos|vũ trụ|galaxy|ngân hà|nebula|starfield|thiên hà|universe|black hole|supernova|constellation)/i,
    style: "cinematic cosmic scene, ultra-detailed nebulae, swirling star clusters, sense of infinite depth, hyperreal astrophotography aesthetic",
    lighting: "brilliant volumetric starlight, radiant lens flares, luminous atmospheric bloom",
    palette: "deep indigo, magenta nebula, cyan star-glow, warm gold highlights",
  },
  {
    topic: "mandala",
    match: /(mandala|họa tiết đối xứng|kaleidoscop|sacred geometry|hình học thiêng|yantra)/i,
    style: "intricate sacred-geometry mandala, perfectly radial symmetry, ultra-fine linework, layered floral petals, spiritual iconography",
    lighting: "soft radiant halo, gentle inner glow, backlit divine aura",
    palette: "gold leaf, ivory, turquoise, soft rose, midnight blue background",
  },
  {
    topic: "meditation",
    match: /(thiền|meditation|zen|tĩnh lặng|an lạc|serene|mindful|lotus pose|yoga)/i,
    style: "serene meditation scene, calm zen composition, harmonious balance, peaceful spiritual atmosphere",
    lighting: "soft golden hour glow, gentle diffused light, warm halo",
    palette: "warm cream, dusty rose, sage green, muted gold",
  },
  {
    topic: "lightbeing",
    match: /(thiên thần|angel|seraph|light being|ánh sáng thuần khiết|being of light|ascended master|divine feminine|divine masculine)/i,
    style: "ethereal being of light, translucent luminous form, flowing energy ribbons, spiritually elevated presence, hyperreal digital painting",
    lighting: "radiant divine backlight, holy halo, bioluminescent skin glow, god rays",
    palette: "brilliant white, iridescent pearl, gold, opal, soft lavender",
  },
  {
    topic: "animal",
    match: /(\bmèo\b|\bcat\b|kitten|\bchó\b|\bdog\b|puppy|\bchim\b|\bbird\b|thú cưng|\bpet\b|\banimal\b|rồng|dragon|ngựa|\bhorse\b|voi|elephant|\bhổ\b|tiger|sư tử|lion|\bcá\b|\bfish\b|thỏ|rabbit|bunny|khỉ|monkey|gấu|\bbear\b|panda|gấu trúc|cáo|\bfox\b|sói|\bwolf\b|nai|deer|hươu|đại bàng|eagle|hạc|crane|bướm|butterfly|cú|\bowl\b|vẹt|parrot|thiên nga|swan|công|peacock|hamster|hamster|sóc|squirrel)/i,
    style: "adorable animal photography, tack-sharp fur or feather detail, endearing pose, natural pet or wildlife portrait, subject centered, no humans in frame",
    lighting: "soft natural light, gentle rim light, warm golden hour ambience",
    palette: "natural coat colors, soft complementary background, harmonious warm-cool balance",
  },
  {
    topic: "portrait",
    match: /(chân dung|portrait|headshot|khuôn mặt|face of|selfie)/i,
    style: "professional portrait, tack-sharp eyes, natural skin texture, shallow depth of field, subject centered, editorial magazine composition",
    lighting: "rembrandt lighting, soft key light with warm rim, catchlight in eyes",
    palette: "natural skin tones, complementary background, subtle warm-cool contrast",
  },
  {
    topic: "architecture",
    match: /(biệt thự|villa|mansion|ngôi nhà|căn nhà|căn hộ|apartment|penthouse|nội thất|interior|kiến trúc|architecture|toà nhà|tòa nhà|building|resort|khách sạn|hotel|văn phòng|office|nhà thờ|church|cathedral|đền|temple|chùa|pagoda|garden|vườn|house(?!\s*of\s*(?:cards|god))|home\s+design)/i,
    style: "architectural photography, wide-angle exterior view, unoccupied scene without people, clean geometry, symmetrical framing, professional real-estate aesthetic",
    lighting: "golden hour sunlight, soft ambient sky light, natural shadows",
    palette: "warm neutrals, natural stone and wood tones, sky blue accents, lush greenery",
  },
  {
    topic: "landscape",
    match: /(phong cảnh|landscape|scenery|núi non|mountain|biển|ocean|forest|rừng|thác|waterfall|sunset|hoàng hôn|sunrise|bình minh)/i,
    style: "cinematic landscape photography, epic wide vista, foreground-midground-background depth layers, rule-of-thirds composition",
    lighting: "golden hour light, dramatic atmospheric haze, volumetric god rays",
    palette: "warm gold, deep teal, soft coral sky, rich earth tones",
  },
  {
    topic: "poster",
    match: /(poster|banner|thumbnail|artwork|illustration|áp phích|bìa|cover|album art)/i,
    style: "bold poster illustration, striking central subject, dynamic composition, professional graphic design layout, print-ready aesthetic",
    lighting: "dramatic key lighting, high contrast, punchy highlights",
    palette: "vibrant complementary colors, high saturation, clean readable typography space",
  },
];

const GENERIC_PRESET: Omit<ArtPreset, "topic" | "match"> = {
  style: "premium digital artwork, thoughtful composition, tasteful subject framing, rich fine detail",
  lighting: "cinematic soft lighting, luminous highlights, gentle warm glow",
  palette: "harmonious warm-cool balance, elegant accent colors",
};

const QUALITY_TAGS = "ultra sharp, 8k detail, professional design, masterful composition, high dynamic range, photorealistic clarity";

const ALREADY_ENRICHED = /(ultra sharp|8k|professional design|masterpiece|highly detailed|photoreal|cinematic lighting|volumetric)/i;

// Bước 3 — nới ngưỡng skip từ 200 → 500. Prompt dài đã được distill xuống
// còn ≤ 220 char (xem `image-distill.ts`) nên hầu như luôn qua được enrich.
const SKIP_MIN_LEN = 500;

/** Topic được phép chứa chữ trong ảnh (logo/poster). Còn lại → cấm chữ. */
const TEXT_ALLOWED_TOPICS: ArtTopic[] = ["logo", "poster"];

export function classifyArtTopic(prompt: string): ArtTopic {
  const t = (prompt || "").trim();
  if (!t) return "generic";
  for (const p of PRESETS) {
    if (p.match.test(t)) return p.topic;
  }
  return "generic";
}

export function isDesignHeavyTopic(topic: ArtTopic): boolean {
  return topic === "logo" || topic === "cosmos" || topic === "mandala" || topic === "poster" || topic === "lightbeing";
}

/** Topic mà mặc định KHÔNG nên chèn nhân vật/khuôn mặt trừ khi user yêu cầu rõ. */
const NO_PEOPLE_TOPICS: ArtTopic[] = ["architecture", "landscape", "cosmos", "mandala", "logo", "animal"];

/** Regex phát hiện user chủ động yêu cầu có người → tắt negative prompt. */
const PEOPLE_MENTION_RE = /(\bngười\b|nhân vật|cô gái|chàng trai|em bé|trẻ em|gia đình|người mẫu|người phụ nữ|người đàn ông|portrait|\bperson\b|people|human|\bman\b|\bwoman\b|\bgirl\b|\bboy\b|\bchild\b|family|character|figure)/i;

export interface EnrichOptions {
  /** Bỏ qua check chiều dài — luôn enrich (dùng khi force upgrade Pro model). */
  force?: boolean;
}

export interface EnrichResult {
  prompt: string;
  topic: ArtTopic;
  enriched: boolean;
  reason?: string;
}

/**
 * Làm giàu prompt trước khi gửi model. Idempotent — không double-enrich.
 */
export function enrichImagePrompt(prompt: string, opts: EnrichOptions = {}): EnrichResult {
  const raw = (prompt || "").trim();
  if (!raw) return { prompt: raw, topic: "generic", enriched: false, reason: "empty" };

  const topic = classifyArtTopic(raw);

  if (!opts.force) {
    if (raw.length >= SKIP_MIN_LEN) {
      return { prompt: raw, topic, enriched: false, reason: "already_long" };
    }
    if (ALREADY_ENRICHED.test(raw)) {
      return { prompt: raw, topic, enriched: false, reason: "already_has_quality_tags" };
    }
  }

  const preset = PRESETS.find((p) => p.topic === topic);
  const style = preset?.style ?? GENERIC_PRESET.style;
  const lighting = preset?.lighting ?? GENERIC_PRESET.lighting;
  const palette = preset?.palette ?? GENERIC_PRESET.palette;

  // Format: giữ nguyên intent user rồi append style block sạch, dễ parse cho model.
  const parts = [
    raw,
    "—",
    `Style: ${style}.`,
    `Lighting: ${lighting}.`,
    `Palette: ${palette}.`,
    `Quality: ${QUALITY_TAGS}.`,
  ];

  // Negative prompt: chặn model chèn người vào topic kiến trúc/phong cảnh/vũ trụ/mandala/logo
  // trừ khi user đã yêu cầu rõ trong prompt gốc.
  if (NO_PEOPLE_TOPICS.includes(topic) && !PEOPLE_MENTION_RE.test(raw)) {
    parts.push("Do NOT include people, faces, or human figures unless explicitly requested.");
  }

  // Bước 2 — Anti-text guardrail: mọi topic ngoài logo/poster đều cấm render chữ.
  // Ngăn model diffusion vẽ "slide" chứa chữ giả méo khi user đưa prompt dạng văn bản.
  if (!TEXT_ALLOWED_TOPICS.includes(topic)) {
    parts.push("Do NOT render any text, letters, words, captions, slides, UI mockups, or typography in the image.");
  }

  return { prompt: parts.join(" "), topic, enriched: true };
}
