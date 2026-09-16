// Client-side sensitivity classifier for questions sent to Angel gốc.
//
// Mục đích: khi bên Angel gốc mint API key mới với scope="open" (fallback LLM
// khi RAG miss), FUN Profile vẫn cần chặn hallucination cho các câu hỏi nhạy
// cảm nội bộ (tên người dùng, ví, mật khẩu, link cá nhân Fun.Rich...). Với các
// câu đó, ép `answer_mode: "internal_only"` để Angel gốc CHỈ trả lời khi có
// RAG match; miss RAG → trả câu chuẩn "chưa có thông tin".
//
// Các câu kiến thức phổ thông (VC, blockchain, khái niệm chung...) → để
// `answer_mode: "open"` để Angel gốc được phép fallback LLM.

export type AnswerMode = "internal_only" | "open" | "auto";

// Từ khoá cứng: nếu xuất hiện → luôn internal_only.
const INTERNAL_HARD_KEYWORDS = [
  // Định danh bí mật
  "mật khẩu", "password", "private key", "seed phrase", "recovery phrase",
  "khoá riêng", "khóa riêng", "mã pin", "otp code",
  // Ví/địa chỉ ví cá nhân
  "ví của bé", "ví của con", "ví cá nhân", "địa chỉ ví",
  // Nội bộ FUN Ecosystem
  "fun.rich/", "funrich_community", "@angelfun", "camly duong", "founder camly",
  "bé vũ", "bé ly", "bé an", "bé minh",
  // Quyền hạn / hệ thống
  "role admin", "user_roles", "supabase", "edge function",
];

// Dấu hiệu câu hỏi kiến thức phổ thông (đầu tư, công nghệ, khái niệm...) →
// cho phép fallback mở. Không exhaustive — chỉ heuristic.
const PUBLIC_KNOWLEDGE_HINTS = [
  // Nhà đầu tư / quỹ nổi tiếng
  "a16z", "andreessen", "sequoia", "paradigm", "electric capital",
  "coinbase ventures", "binance labs", "multicoin", "polychain",
  "y combinator", "y-combinator", "tiger global", "softbank",
  // Blockchain / công nghệ chung
  "ethereum", "bitcoin", "solana", "polkadot", "cosmos", "avalanche",
  "layer 2", "layer2", "zk-rollup", "rollup", "defi", "nft",
  "smart contract", "consensus", "proof of stake", "proof of work",
  // Khái niệm chung
  "là gì", "là ai", "nghĩa là", "định nghĩa", "how to", "what is", "who is",
];

// Regex phát hiện địa chỉ ví (EVM 0x..., BTC bc1...).
const WALLET_ADDR_RE = /(0x[a-fA-F0-9]{40}|bc1[a-z0-9]{20,}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})/;

export function classifyQuestionSensitivity(text: string): AnswerMode {
  const t = (text || "").toLowerCase().trim();
  if (!t) return "auto";

  // 1. Địa chỉ ví / hash → internal
  if (WALLET_ADDR_RE.test(text)) return "internal_only";

  // 2. Từ khoá nhạy cảm cứng
  for (const kw of INTERNAL_HARD_KEYWORDS) {
    if (t.includes(kw)) return "internal_only";
  }

  // 3. Kiến thức phổ thông → open
  for (const hint of PUBLIC_KNOWLEDGE_HINTS) {
    if (t.includes(hint)) return "open";
  }

  // 4. Mặc định auto — để Angel gốc quyết định theo persona/policy.
  return "auto";
}
