import { createClient } from "npm:@supabase/supabase-js@2";
import { archiveReplayToR2 } from "../_shared/archiveReplay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildUrls(uid: string, customerCode: string) {
  const base = customerCode
    ? `https://customer-${customerCode}.cloudflarestream.com/${uid}`
    : `https://videodelivery.net/${uid}`;
  return {
    hls: `${base}/manifest/video.m3u8`,
    dash: `${base}/manifest/video.mpd`,
    thumbnail: `${base}/thumbnails/thumbnail.jpg?time=3s`,
  };
}

async function enableMp4Download(
  accountId: string,
  apiToken: string,
  uid: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}/downloads`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    const def = j?.result?.default;
    return def?.status === "ready" && typeof def?.url === "string" ? def.url : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
    const apiToken =
      Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN") ??
      Deno.env.get("CLOUDFLARE_STREAM_TOKEN") ??
      "";
    const customerCode = Deno.env.get("CLOUDFLARE_STREAM_CUSTOMER_CODE") ?? "";

    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase config" }, 500);
    if (!accountId || !apiToken) return json({ error: "Missing Cloudflare config" }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: pending, error: pendErr } = await supabase
      .from("live_replays")
      .select("id, live_session_id, stream_uid, status, created_at")
      .in("status", ["uploading", "queued", "processing"])
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(20);

    if (pendErr) throw pendErr;

    const result = { checked: 0, promoted: 0, failed: 0, still_processing: 0, not_found: 0 };

    for (const row of pending ?? []) {
      result.checked += 1;
      const uid = row.stream_uid as string | null;
      if (!uid) continue;

      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`,
        { headers: { Authorization: `Bearer ${apiToken}` } },
      );

      // 404 — UID not on Cloudflare. If old enough, mark failed.
      if (cfRes.status === 404) {
        const ageMs = Date.now() - new Date(row.created_at as string).getTime();
        if (ageMs > 30 * 60 * 1000) {
          await supabase
            .from("live_replays")
            .update({
              status: "failed",
              error_message: "Stream UID not found on Cloudflare",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          await supabase
            .from("live_sessions")
            .update({
              recording_status: "failed",
              recording_error: "Stream UID not found on Cloudflare",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.live_session_id);
          result.failed += 1;
        } else {
          result.not_found += 1;
        }
        continue;
      }

      if (!cfRes.ok) {
        console.warn(`[reconcile] CF ${cfRes.status} for uid=${uid}`);
        continue;
      }

      const cfJson = await cfRes.json().catch(() => null);
      const v = cfJson?.result;
      if (!v) continue;

      const state = v.status?.state || "";
      const ready = v.readyToStream === true && state === "ready";

      if (ready) {
        const urls = buildUrls(uid, customerCode);
        const playbackHls = v.playback?.hls || urls.hls;
        const playbackDash = v.playback?.dash || urls.dash;
        const thumbnailUrl = v.thumbnail || urls.thumbnail;
        const durationSeconds = Number.isFinite(Number(v.duration))
          ? Math.round(Number(v.duration))
          : null;
        const size = Number.isFinite(Number(v.size)) ? Number(v.size) : null;

        const playbackMp4 = await enableMp4Download(accountId, apiToken, uid);

        await supabase
          .from("live_replays")
          .update({
            status: "ready",
            archive_status: "pending",
            cloudflare_playback_url: playbackHls,
            cloudflare_mp4_download_url: playbackMp4,
            playback_hls: playbackHls,
            playback_dash: playbackDash,
            playback_mp4: playbackMp4,
            thumbnail_url: thumbnailUrl,
            duration_seconds: durationSeconds,
            filesize_bytes: size,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        const { data: live } = await supabase
          .from("live_sessions")
          .select("id, post_id")
          .eq("id", row.live_session_id)
          .maybeSingle();

        if (live?.post_id) {
          const { data: post } = await supabase
            .from("posts")
            .select("metadata")
            .eq("id", live.post_id)
            .maybeSingle();
          const metadata = {
            ...((post?.metadata as Record<string, unknown> | null) || {}),
            live_status: "ended",
            replay_status: "ready",
            replay_ready_at: new Date().toISOString(),
            archive_status: "pending",
            playback_type: "cloudflare_stream",
            playback_url: playbackHls,
            playback_hls: playbackHls,
            playback_dash: playbackDash,
            playback_mp4: playbackMp4,
            stream_uid: uid,
            thumbnail_url: thumbnailUrl,
            duration_seconds: durationSeconds,
          };
          await supabase
            .from("posts")
            .update({ video_url: playbackHls, metadata })
            .eq("id", live.post_id);
        }

        await supabase
          .from("live_sessions")
          .update({
            recording_status: "ready",
            archive_status: "pending",
            cloudflare_playback_url: playbackHls,
            cloudflare_mp4_download_url: playbackMp4,
            recording_ready_at: new Date().toISOString(),
            recording_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.live_session_id);

        await archiveReplayToR2({ supabase, replayId: row.id });

        result.promoted += 1;
      } else if (state === "error") {
        const errText =
          v.status?.errorReasonText ||
          v.status?.errReasonText ||
          v.status?.errorReasonCode ||
          "Cloudflare Stream processing failed";
        await supabase
          .from("live_replays")
          .update({
            status: "failed",
            error_message: errText,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        await supabase
          .from("live_sessions")
          .update({
            recording_status: "failed",
            recording_error: errText,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.live_session_id);
        result.failed += 1;
      } else {
        // still processing — just bump status to 'processing'
        await supabase
          .from("live_replays")
          .update({ status: "processing", updated_at: new Date().toISOString() })
          .eq("id", row.id)
          .in("status", ["uploading", "queued"]);
        result.still_processing += 1;
      }
    }

    return json({ ok: true, ...result });
  } catch (error) {
    console.error("[reconcile-pending-replays]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
