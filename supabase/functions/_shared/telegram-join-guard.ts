// Join Gate — chặn thành viên mới có TÊN hoặc AVATAR nhạy cảm khi vào nhóm.
//
// 1. Quét tên (first_name + last_name + username): 0 credit, chạy luôn.
// 2. Quét avatar bằng vision model rẻ (gemini flash lite), cache theo
//    file_unique_id trong bảng `telegram_join_avatar_scans` để không tốn credit lặp.
//
// Hành động: ban (mặc định) hoặc kick, xoá tin "X đã tham gia nhóm", ghi log.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getFlag } from "./angel/flags.ts";
import { tryFetchTelegramMedia } from "./telegram-media.ts";
import { callAiGateway, gatewayText } from "./ai-gateway-retry.ts";

export type JoinGuardVerdict = "safe" | "suspicious" | "explicit";

export interface JoinGuardSettingsLike {
  join_guard_name_enabled?: boolean | null;
  join_guard_name_keywords?: string | null;
  join_guard_name_allowlist?: string | null;
  join_guard_avatar_enabled?: boolean | null;
  join_guard_avatar_threshold?: string | null;
  join_guard_action?: string | null;
}

// ─── Chuẩn hoá tên ───────────────────────────────────────────────────────────

const LEET_MAP: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s",
};

export function normalizeJoinName(input: string): string {
  let t = (input ?? "").toString().toLowerCase();
  // bỏ zero-width & ký tự điều khiển
  t = t.replace(/[\u200b-\u200f\u2060\ufeff]/g, "");
  // bỏ dấu tiếng Việt
  t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  // leet
  t = t.replace(/[013457 8@$]/g, (c) => LEET_MAP[c] ?? c);
  // gộp ký tự không phải chữ/số thành khoảng trắng
  t = t.replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]+/g, " ");
  return t.replace(/\s+/g, " ").trim();
}

// Từ khoá mặc định (severity cao) — 18+, mời gọi, bán tài khoản, cờ bạc, bait CJK.
const DEFAULT_NAME_KEYWORDS = [
  // 18+
  "sex", "sexy", "porn", "pornhub", "xxx", "hentai", "nude", "nudes", "onlyfans",
  "escort", "callgirl", "call girl", "camgirl", "cam girl", "milf", "hooker",
  "phim sex", "phimsex", "gai goi", "gaigoi", "checker", "massage kich duc",
  "sugar baby", "sugarbaby", "sugar daddy", "sugardaddy", "bao dam", "bao nuoi",
  "18 ", "18+", "sex chat", "sexchat", "dam duc", "khieu dam",
  // bán tài khoản / carding
  "bubu store", "acc shop", "shop acc", "ban acc", "sell account", "account shop",
  "cvv", "carding", "fullz", "bank log", "banklog",
  // cờ bạc
  "casino", "789bet", "nohu", "no hu", "ta88", "jun88", "sunwin", "keo nha cai",
  // CJK bait
  "约炮", "包养", "裸聊", "色情", "赌场", "博彩", "菠菜", "刷单", "同城约",
];

export interface NameHit {
  keyword: string;
  source: "default" | "group" | "blocked_keywords";
}

function splitList(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[\n,]+/)
    .map((s) => normalizeJoinName(s))
    .filter((s) => s.length >= 2);
}

export function scanJoinName(
  rawName: string,
  opts: { extraKeywords?: string[]; allowlist?: string[] } = {},
): NameHit | null {
  const name = normalizeJoinName(rawName);
  if (!name) return null;

  for (const allow of opts.allowlist ?? []) {
    if (allow && name.includes(allow)) return null;
  }

  const matches = (kw: string) => {
    if (!kw) return false;
    if (/[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(kw)) return name.includes(kw);
    // token-ish match để tránh oan (vd "essex" không dính "sex")
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(name);
  };

  for (const kw of opts.extraKeywords ?? []) {
    if (matches(kw)) return { keyword: kw, source: "group" };
  }
  for (const kw of DEFAULT_NAME_KEYWORDS) {
    if (matches(normalizeJoinName(kw))) return { keyword: kw, source: "default" };
  }
  return null;
}

// ─── Quét avatar ─────────────────────────────────────────────────────────────

const AVATAR_MODEL = Deno.env.get("ANGEL_MODEL_VISION") || "google/gemini-3.1-flash-lite";

export interface AvatarScanResult {
  verdict: JoinGuardVerdict;
  score: number;
  reason: string;
  fileUniqueId: string;
  cached: boolean;
}

export async function scanAvatarImage(params: {
  adminClient: SupabaseClient;
  fileUniqueId: string;
  /** file_id Telegram — ảnh được tải server-side, không đưa URL cho AI. */
  fileId: string;
}): Promise<AvatarScanResult | null> {
  const { adminClient, fileUniqueId, fileId } = params;

  const { data: cached } = await adminClient
    .from("telegram_join_avatar_scans")
    .select("verdict, score, reason")
    .eq("file_unique_id", fileUniqueId)
    .maybeSingle();
  if (cached?.verdict) {
    return {
      verdict: cached.verdict as JoinGuardVerdict,
      score: Number(cached.score ?? 0),
      reason: cached.reason ?? "",
      fileUniqueId,
      cached: true,
    };
  }

  if (!(await getFlag("cost.join_avatar_scan_enabled", true))) {
    console.log("[join-guard] avatar scan skipped — cost.join_avatar_scan_enabled=false");
    return null;
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;

  try {
    const media = await tryFetchTelegramMedia(fileId, "avatar-scan", {
      allowedMimePrefixes: ["image/"],
      maxBytes: 5 * 1024 * 1024,
    });
    if (!media) return null;
    const result0 = await callAiGateway(
      {
        model: AVATAR_MODEL,
        messages: [
          {
            role: "system",
            content:
              'You are a strict profile-picture moderation classifier. Reply with ONLY compact JSON: {"verdict":"safe|suspicious|explicit","score":0-1,"reason":"short reason in Vietnamese"}. ' +
              '"explicit" = nudity, sexual/erotic content, sexual solicitation, pornographic text/watermark, escort or adult-site advertising, gore. ' +
              '"suspicious" = heavily suggestive or borderline (lingerie, provocative pose, adult-looking branding) but not explicit. ' +
              '"safe" = everything else including normal selfies, logos, landscapes, cartoons.',
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Classify this Telegram profile photo." },
              { type: "image_url", image_url: { url: media.dataUrl } },
            ],
          },
        ],
      },
      { apiKey, label: "avatar-scan" },
    );
    if (!result0.ok) return null;
    const raw = gatewayText(result0);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { verdict?: string; score?: number; reason?: string };
    const verdict: JoinGuardVerdict =
      parsed.verdict === "explicit" ? "explicit" : parsed.verdict === "suspicious" ? "suspicious" : "safe";
    const result: AvatarScanResult = {
      verdict,
      score: Number(parsed.score ?? 0),
      reason: (parsed.reason ?? "").toString().slice(0, 300),
      fileUniqueId,
      cached: false,
    };
    await adminClient
      .from("telegram_join_avatar_scans")
      .upsert(
        {
          file_unique_id: fileUniqueId,
          verdict: result.verdict,
          score: result.score,
          reason: result.reason,
        },
        { onConflict: "file_unique_id" },
      );
    return result;
  } catch (err) {
    console.error("[join-guard] avatar scan error", err);
    return null;
  }
}

export function avatarVerdictBlocks(
  verdict: JoinGuardVerdict,
  threshold: string | null | undefined,
): boolean {
  if (verdict === "explicit") return true;
  if (verdict === "suspicious") return (threshold ?? "explicit") === "suspicious";
  return false;
}

export function joinGuardNameOptions(settings: JoinGuardSettingsLike) {
  return {
    extraKeywords: splitList(settings.join_guard_name_keywords),
    allowlist: splitList(settings.join_guard_name_allowlist),
  };
}
