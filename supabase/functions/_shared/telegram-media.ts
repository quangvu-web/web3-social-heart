// _shared/telegram-media.ts
// Tải media Telegram AN TOÀN ở phía server rồi chuyển thành base64 / data URL để
// gửi cho AI Gateway (Gemini/Vertex).
//
// LÝ DO: api.telegram.org/file/bot<TOKEN>/... KHÔNG được đưa cho provider AI:
//   - provider fetch server-side → Telegram chặn → HTTP 400 vĩnh viễn
//   - URL chứa bot token → rò rỉ secret ra prompt/log/analytics
//
// Quy tắc:
//   - Token CHỈ tồn tại trong module này. Mọi log/error đều đi qua redactToken().
//   - 400/403/404 = lỗi VĨNH VIỄN → không retry.
//   - 429 / 5xx / network / timeout = tạm thời → retry có giới hạn, backoff mũ.

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024; // Telegram bot getFile cap
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

export type TelegramMediaErrorCode =
  | "missing_file_id"
  | "no_token"
  | "getfile_failed"
  | "file_not_found"
  | "too_large"
  | "unsupported_mime"
  | "download_failed"
  | "empty_file";

export class TelegramMediaError extends Error {
  readonly code: TelegramMediaErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  constructor(code: TelegramMediaErrorCode, message: string, opts: { retryable?: boolean; status?: number } = {}) {
    super(message);
    this.name = "TelegramMediaError";
    this.code = code;
    this.retryable = opts.retryable ?? false;
    this.status = opts.status;
  }
  toSafeJSON() {
    return { code: this.code, retryable: this.retryable, status: this.status ?? null, message: redactToken(this.message) };
  }
}

export interface TelegramMedia {
  /** Base64 thuần (không có prefix data:) */
  base64: string;
  /** MIME đã xác định (magic bytes → đuôi file → content-type) */
  mime: string;
  /** data:<mime>;base64,<...> — dùng cho image_url của AI Gateway */
  dataUrl: string;
  bytes: Uint8Array;
  size: number;
  /** file_path Telegram, KHÔNG chứa token */
  filePath: string;
}

/** Xoá mọi bot token khỏi chuỗi trước khi log / trả về. */
export function redactToken(input: unknown): string {
  const text = input instanceof Error ? input.message : String(input ?? "");
  return text
    .replace(/(api\.telegram\.org\/(?:file\/)?bot)[A-Za-z0-9:_-]+/gi, "$1<redacted>")
    .replace(/\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/g, "<redacted-token>");
}

function resolveToken(preferred?: string[] | null): string | null {
  const names = preferred?.length ? preferred : ["COMMUNITY_GUARD_BOT_TOKEN", "TELEGRAM_BOT_TOKEN"];
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  return null;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Retry có giới hạn: chỉ cho 429 / 5xx / lỗi mạng. 4xx khác = vĩnh viễn. */
async function requestWithBackoff(
  url: string,
  init: RequestInit,
  label: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      if (res.ok || !isRetryableStatus(res.status)) return res;
      lastError = new TelegramMediaError("download_failed", `${label} HTTP ${res.status}`, {
        retryable: true,
        status: res.status,
      });
      // đọc bỏ body để giải phóng connection
      await res.body?.cancel().catch(() => {});
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    if (attempt < MAX_ATTEMPTS) {
      const delay = 400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new TelegramMediaError("download_failed", `${label} failed: ${redactToken(lastError)}`, { retryable: true });
}

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", bmp: "image/bmp", heic: "image/heic", svg: "image/svg+xml",
  pdf: "application/pdf", txt: "text/plain", csv: "text/csv", md: "text/markdown",
  ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg", mp3: "audio/mpeg",
  m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", flac: "audio/flac",
  webm: "video/webm", mp4: "video/mp4", mov: "video/quicktime",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function sniffMime(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  const ascii = (i: number, s: string) => s.split("").every((c, k) => b[i + k] === c.charCodeAt(0));
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(0, "RIFF") && ascii(8, "WAVE")) return "audio/wav";
  if (ascii(0, "OggS")) return "audio/ogg";
  if (ascii(4, "ftyp")) return "video/mp4";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  if (ascii(0, "ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  if (b[0] === 0x50 && b[1] === 0x4b) return "application/zip"; // docx/xlsx container
  return null;
}

function mimeFromPath(filePath: string): string | null {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? null;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export interface FetchTelegramMediaOptions {
  /** Ưu tiên tên biến môi trường chứa bot token */
  tokenEnvNames?: string[];
  maxBytes?: number;
  /** Ví dụ ["image/"] để chỉ nhận ảnh */
  allowedMimePrefixes?: string[];
  timeoutMs?: number;
}

/**
 * Resolve file_id → tải bytes từ Telegram (server-side, dùng bot token trong env)
 * → trả base64 + MIME + data URL. Token không bao giờ rời khỏi hàm này.
 */
export async function fetchTelegramMedia(
  fileId: string | null | undefined,
  options: FetchTelegramMediaOptions = {},
): Promise<TelegramMedia> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (!fileId || typeof fileId !== "string" || fileId.trim().length < 5) {
    throw new TelegramMediaError("missing_file_id", "file_id is missing or invalid");
  }
  const token = resolveToken(options.tokenEnvNames);
  if (!token) throw new TelegramMediaError("no_token", "Telegram bot token is not configured");

  // 1) getFile
  const infoRes = await requestWithBackoff(
    `https://api.telegram.org/bot${token}/getFile`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    },
    "getFile",
    options.timeoutMs,
  );
  const info = await infoRes.json().catch(() => ({}));
  if (!infoRes.ok || info?.ok === false) {
    const desc = redactToken(info?.description ?? `HTTP ${infoRes.status}`);
    throw new TelegramMediaError("getfile_failed", `getFile rejected: ${desc}`, {
      retryable: isRetryableStatus(infoRes.status),
      status: infoRes.status,
    });
  }
  const filePath: string | undefined = info?.result?.file_path;
  if (!filePath) throw new TelegramMediaError("file_not_found", "getFile returned no file_path");

  const declaredSize: number | undefined = info?.result?.file_size;
  if (declaredSize && declaredSize > maxBytes) {
    throw new TelegramMediaError("too_large", `file too large: ${declaredSize} > ${maxBytes} bytes`);
  }

  // 2) Tải nội dung
  const fileRes = await requestWithBackoff(
    `https://api.telegram.org/file/bot${token}/${filePath}`,
    { method: "GET" },
    "file download",
    options.timeoutMs,
  );
  if (!fileRes.ok) {
    throw new TelegramMediaError("download_failed", `file download HTTP ${fileRes.status}`, {
      retryable: isRetryableStatus(fileRes.status),
      status: fileRes.status,
    });
  }
  const bytes = new Uint8Array(await fileRes.arrayBuffer());
  if (bytes.byteLength === 0) throw new TelegramMediaError("empty_file", "downloaded file is empty");
  if (bytes.byteLength > maxBytes) {
    throw new TelegramMediaError("too_large", `file too large: ${bytes.byteLength} > ${maxBytes} bytes`);
  }

  const headerMime = (fileRes.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  let mime =
    sniffMime(bytes) ||
    mimeFromPath(filePath) ||
    (headerMime && headerMime !== "application/octet-stream" ? headerMime : "") ||
    "application/octet-stream";
  if (mime === "application/zip") mime = mimeFromPath(filePath) || mime;

  const allowed = options.allowedMimePrefixes;
  if (allowed?.length && !allowed.some((p) => mime.startsWith(p))) {
    throw new TelegramMediaError("unsupported_mime", `unsupported media type: ${mime}`);
  }

  const base64 = bytesToBase64(bytes);
  return { base64, mime, dataUrl: `data:${mime};base64,${base64}`, bytes, size: bytes.byteLength, filePath };
}

/**
 * Bản không throw — trả null và log an toàn (đã redact token).
 * Dùng cho các luồng "best effort" như OCR / mô tả ảnh / quét avatar.
 */
export async function tryFetchTelegramMedia(
  fileId: string | null | undefined,
  label: string,
  options: FetchTelegramMediaOptions = {},
): Promise<TelegramMedia | null> {
  try {
    return await fetchTelegramMedia(fileId, options);
  } catch (err) {
    const safe =
      err instanceof TelegramMediaError
        ? err.toSafeJSON()
        : { code: "download_failed", retryable: false, status: null, message: redactToken(err) };
    console.warn(`[telegram-media] ${label} failed`, safe);
    return null;
  }
}

/** Chuẩn hoá MIME ảnh cho AI Gateway (Gemini chỉ nhận png/jpeg/webp/gif/heic). */
export function isGeminiSupportedImageMime(mime: string): boolean {
  return ["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "image/heif"].includes(mime);
}
