// Backfill MP4 download for old live_replay posts that only have HLS.
// Flow per post:
//   1) Load posts.metadata.playback_hls
//   2) CF Stream "copy from URL" with the HLS manifest → uid
//   3) Poll until readyToStream
//   4) Request MP4 download (POST /downloads) → poll until status === "ready"
//   5) Fetch MP4 from CF → PUT to R2 archive
//   6) Update posts + live_sessions with download_mp4_parts + playback_mp4
//   7) Delete the CF Stream video to avoid recurring storage cost
import { createClient } from "npm:@supabase/supabase-js@2";
import { getR2Config, publicR2Url, putR2Object, sanitizeR2Key } from "../_shared/r2Archive.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CF_ACCOUNT = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
const CF_TOKEN = Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function cfFetch(path: string, init?: RequestInit) {
  return fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CF_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function copyFromUrl(hlsUrl: string): Promise<string> {
  const res = await cfFetch(`/accounts/${CF_ACCOUNT}/stream/copy`, {
    method: "POST",
    body: JSON.stringify({ url: hlsUrl, meta: { source: "backfill-replay-mp4" } }),
  });
  const data = await res.json();
  if (!res.ok || !data?.result?.uid) {
    throw new Error(`CF copy failed: ${res.status} ${JSON.stringify(data).slice(0, 400)}`);
  }
  return data.result.uid as string;
}

async function waitReady(uid: string, timeoutMs = 30 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await cfFetch(`/accounts/${CF_ACCOUNT}/stream/${uid}`);
    const data = await res.json();
    if (res.ok && data?.result?.readyToStream) return data.result;
    if (data?.result?.status?.state === "error") {
      throw new Error(`CF transcode error: ${JSON.stringify(data.result.status)}`);
    }
    await sleep(8000);
  }
  throw new Error("CF transcode timed out");
}

async function enableAndWaitMp4(uid: string, timeoutMs = 20 * 60 * 1000): Promise<string> {
  // Trigger MP4 generation
  const create = await cfFetch(`/accounts/${CF_ACCOUNT}/stream/${uid}/downloads`, { method: "POST" });
  if (!create.ok) {
    const t = await create.text();
    throw new Error(`CF enable MP4 failed: ${create.status} ${t.slice(0, 400)}`);
  }
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await cfFetch(`/accounts/${CF_ACCOUNT}/stream/${uid}/downloads`);
    const data = await res.json();
    const def = data?.result?.default;
    if (def?.status === "ready" && def?.url) return def.url as string;
    if (def?.status === "error") throw new Error(`CF MP4 error: ${JSON.stringify(def)}`);
    await sleep(6000);
  }
  throw new Error("CF MP4 render timed out");
}

async function deleteCfVideo(uid: string) {
  try {
    await cfFetch(`/accounts/${CF_ACCOUNT}/stream/${uid}`, { method: "DELETE" });
  } catch (e) {
    console.warn("[backfill-replay-mp4] CF delete failed", uid, e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!CF_ACCOUNT || !CF_TOKEN) {
      return json({ error: "Missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_STREAM_API_TOKEN" }, 500);
    }

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const r2 = getR2Config();

    const body = await req.json().catch(() => ({}));
    const postIds: string[] = Array.isArray(body?.post_ids) ? body.post_ids.filter((s: unknown) => typeof s === "string") : [];

    let targets: { id: string; metadata: any; user_id: string }[] = [];
    if (postIds.length > 0) {
      const { data, error } = await supabase
        .from("posts")
        .select("id, metadata, user_id")
        .in("id", postIds);
      if (error) throw error;
      targets = (data ?? []) as any;
    } else {
      // Auto-find: live_replay posts with HLS but no MP4 parts
      const { data, error } = await supabase
        .from("posts")
        .select("id, metadata, user_id, download_mp4_parts")
        .eq("post_type", "live_replay")
        .limit(20);
      if (error) throw error;
      targets = ((data ?? []) as any[]).filter((p) => {
        const md = p.metadata || {};
        const hasMp4Parts = Array.isArray(p.download_mp4_parts) && p.download_mp4_parts.length > 0;
        const candidate = md.playback_hls || md.playback_url || md.playback_mp4 || "";
        return !hasMp4Parts && /\.m3u8/i.test(String(candidate));
      });
    }

    const results: any[] = [];

    for (const post of targets) {
      const startedAt = Date.now();
      const md = post.metadata || {};
      // Detect HLS URL from any field (older posts mistakenly stored .m3u8 in playback_mp4)
      const candidates = [md.playback_hls, md.playback_url, md.playback_mp4].filter((v: unknown) => typeof v === "string") as string[];
      const hlsUrl: string | undefined = candidates.find((u) => /\.m3u8/i.test(u));
      const sessionId: string | undefined = md.live_session_id || md.sessionId;

      if (!hlsUrl) {
        results.push({ postId: post.id, ok: false, error: "No playback_hls" });
        continue;
      }

      try {
        console.log("[backfill-replay-mp4] start", { postId: post.id, hlsUrl });

        const uid = await copyFromUrl(hlsUrl);
        console.log("[backfill-replay-mp4] cf uid", post.id, uid);
        await waitReady(uid);
        const mp4Url = await enableAndWaitMp4(uid);
        console.log("[backfill-replay-mp4] mp4 ready", post.id, mp4Url);

        // Download MP4 bytes
        const dl = await fetch(mp4Url);
        if (!dl.ok) throw new Error(`Download MP4 failed: ${dl.status}`);
        const buf = new Uint8Array(await dl.arrayBuffer());
        console.log("[backfill-replay-mp4] mp4 downloaded bytes", post.id, buf.byteLength);

        // Upload to R2 archive
        const folder = sessionId || post.id;
        const archiveKey = sanitizeR2Key(`replays/${post.user_id || "unknown"}/backfill/${folder}/replay.mp4`);
        const put = await putR2Object(r2, r2.archiveBucket, archiveKey, buf, "video/mp4");
        if (!put.ok) throw new Error(`R2 PUT failed: ${put.status} ${(await put.text()).slice(0, 300)}`);
        const publicMp4 = publicR2Url(r2, archiveKey);
        console.log("[backfill-replay-mp4] r2 archived", post.id, publicMp4);

        const parts = [{ index: 0, key: archiveKey, url: publicMp4, size: buf.byteLength }];

        // Update post metadata
        const newMetadata = { ...md, playback_mp4: publicMp4, download_mp4_parts: parts };
        await supabase
          .from("posts")
          .update({ metadata: newMetadata, download_mp4_parts: parts })
          .eq("id", post.id);

        // Update live_session if known
        if (sessionId) {
          await supabase
            .from("live_sessions")
            .update({ download_mp4_parts: parts, updated_at: new Date().toISOString() })
            .eq("id", sessionId);
        }

        await deleteCfVideo(uid);

        results.push({ postId: post.id, ok: true, mp4Url: publicMp4, bytes: buf.byteLength, elapsedMs: Date.now() - startedAt });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("[backfill-replay-mp4] failed", post.id, message);
        results.push({ postId: post.id, ok: false, error: message });
      }
    }

    return json({ ok: true, count: results.length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[backfill-replay-mp4] fatal", message);
    return json({ ok: false, error: message }, 500);
  }
});
