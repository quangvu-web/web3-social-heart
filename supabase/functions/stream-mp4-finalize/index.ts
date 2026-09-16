import { createClient } from "npm:@supabase/supabase-js@2";
import { archiveReplayToR2 } from "../_shared/archiveReplay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * GET (or POST to create) the MP4 download for a Cloudflare Stream video.
 * If the MP4 has not been requested yet, POST kicks off the render.
 * Returns { url, status } where status is "ready" | "inprogress" | null.
 */
async function fetchOrCreateMp4(uid: string): Promise<{ url: string | null; status: string | null }> {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
  const apiToken = Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN") ?? "";
  if (!accountId || !apiToken) return { url: null, status: null };

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}/downloads`;

  // Try GET first (cheap when render already started).
  let res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  let body = await res.json().catch(() => ({} as Record<string, unknown>));
  let def = (body as { result?: { default?: { url?: string; status?: string } } })?.result?.default;

  // If no render exists yet, POST to create one.
  if (!def?.status) {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });
    body = await res.json().catch(() => ({} as Record<string, unknown>));
    def = (body as { result?: { default?: { url?: string; status?: string } } })?.result?.default;
  }

  const status = def?.status ?? null;
  const mp4Url = typeof def?.url === "string" ? def.url : null;
  return {
    url: status === "ready" ? mp4Url : null,
    status,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Missing Supabase configuration" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const replayId = typeof body?.replay_id === "string" ? body.replay_id : null;
    const sessionId = typeof body?.live_session_id === "string" ? body.live_session_id : null;
    if (!replayId && !sessionId) {
      return json({ error: "replay_id or live_session_id required" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let q = supabase
      .from("live_replays")
      .select("id, live_session_id, stream_uid, playback_mp4, status");
    if (replayId) q = q.eq("id", replayId);
    else if (sessionId) q = q.eq("live_session_id", sessionId).order("created_at", { ascending: false }).limit(1);
    const { data: replay, error: replayErr } = await q.maybeSingle();
    if (replayErr) throw replayErr;
    if (!replay) return json({ error: "Replay not found" }, 404);

    if (!replay.stream_uid) {
      return json({ ok: true, status: replay.status, mp4_ready: false, message: "No stream_uid yet" });
    }

    if (replay.playback_mp4) {
      const archive = await archiveReplayToR2({ supabase, replayId: replay.id });
      return json({ ok: true, status: archive.status, mp4_ready: archive.status === "archived", playback_mp4: archive.r2_video_url ?? replay.playback_mp4, archive });
    }

    const result = await fetchOrCreateMp4(replay.stream_uid);

    if (result.url) {
      // Update live_replays
      const { error: updErr } = await supabase
        .from("live_replays")
        .update({ playback_mp4: result.url, updated_at: new Date().toISOString() })
        .eq("id", replay.id);
      if (updErr) console.warn("[stream-mp4-finalize] live_replays update", updErr);

      // Update posts.metadata.playback_mp4 if linked
      const { data: live } = await supabase
        .from("live_sessions")
        .select("post_id")
        .eq("id", replay.live_session_id)
        .maybeSingle();

      if (live?.post_id) {
        const { data: post } = await supabase
          .from("posts")
          .select("metadata")
          .eq("id", live.post_id)
          .maybeSingle();
        const metadata = {
          ...((post?.metadata as Record<string, unknown> | null) || {}),
          playback_mp4: result.url,
        };
        await supabase
          .from("posts")
          .update({ metadata })
          .eq("id", live.post_id);
      }

      const archive = await archiveReplayToR2({ supabase, replayId: replay.id });
      return json({ ok: true, status: archive.status, mp4_ready: archive.status === "archived", playback_mp4: archive.r2_video_url ?? result.url, archive });
    }

    return json({
      ok: true,
      status: result.status ?? "inprogress",
      mp4_ready: false,
      message: "MP4 still rendering on Cloudflare Stream",
    });
  } catch (error) {
    console.error("[stream-mp4-finalize]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
