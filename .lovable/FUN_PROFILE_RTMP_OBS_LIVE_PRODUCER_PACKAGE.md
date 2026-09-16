# Fun Profile RTMP/OBS Live Producer Package

Ngay tao: 2026-05-10
Pham vi: Thiet ke lai flow RTMP/OBS Live cua Fun Profile theo mo hinh chuyen nghiep giong Facebook Live Producer.

## Ten tinh nang

**Fun Profile RTMP/OBS Live Producer**

Ten ky thuat: **RTMP/OBS Live Producer Flow with Gated Go Live**

## Muc tieu

Khi creator chon **Live bang phan mem phat truc tiep / RTMP / OBS**, he thong hien thi Live Producer Dashboard gom 3 buoc:

1. **Ket noi nguon video**
   - Tao Cloudflare Stream Live Input rieng cho phien live.
   - Hien RTMPS URL va Stream Key.
   - Creator copy vao OBS/Streamlabs/XSplit.
   - Khi OBS Start Streaming, Cloudflare webhook/polling cap nhat `source_connected`.
   - Quan trong: nguon video co the connected nhung chua public len feed.

2. **Hoan tat chi tiet bai viet**
   - Bat buoc nhap title.
   - Bat buoc nhap description.
   - Trim whitespace.
   - Neu hop le thi status co the thanh `ready_to_go_live`.

3. **Phat truc tiep**
   - Nut **Phat truc tiep** chi enabled khi:
     - OBS/Cloudflare source da connected.
     - Title hop le.
     - Description hop le.
     - HLS/playback URL san sang.
   - Khi bam nut, backend tao LIVE post tren feed/profile ca nhan.
   - Viewer moi bat dau thay LIVE post va xem video.

## Audit hien trang truoc khi sua

### Da co san

- `supabase/functions/live-rtmp/index.ts`
  - Tao Cloudflare Stream Live Input.
  - Luu RTMPS URL va encrypted Stream Key.
  - Owner co the xem/copy/reset Stream Key.
  - Co polling Cloudflare Live Input.

- `supabase/functions/stream-webhook/index.ts`
  - Verify Cloudflare webhook.
  - Nhan connected/disconnected/video ready.
  - Trigger archive replay sang R2.

- `src/modules/live/pages/RtmpHostPage.tsx`
  - UI OBS control panel co RTMPS URL, Stream Key, preview va end live.

- `src/modules/live/rtmpService.ts`
  - Frontend service goi Edge Function `live-rtmp`.

- `supabase/functions/_shared/archiveReplay.ts`
  - Export/download MP4 tu Cloudflare Stream.
  - Upload sang R2.
  - Verify R2.
  - Tao/update replay post va creator library.
  - Delete Stream video sau khi archive thanh cong.

### Thieu / sai flow

- Cloudflare connected la co the day session thanh `live` qua som.
- OBS connected co the tao LIVE post ngay, trong khi user chua bam **Phat truc tiep**.
- Chua co trang thai `source_connected` va `ready_to_go_live`.
- Chua co buoc bat buoc title/description truoc khi public.
- UI chua co producer dashboard 3 buoc.
- Reset Stream Key can chan khi source dang connected/public live.
- Can tach `live_post_id` va `replay_post_id` de tranh duplicate post.

## Thiet ke moi

### State machine

`live_sessions.status` cho RTMP/OBS:

- `created`
- `waiting_for_obs`
- `source_connected`
- `ready_to_go_live`
- `live`
- `ended`
- `processing`
- `archiving`
- `posted`
- `failed`

### Truong DB bo sung

- `stream_key_last_reset_at`
- `source_connected_at`
- `go_live_clicked_at`
- `live_post_id`
- `replay_post_id`

### Flow chuan

````text
User mo RTMP/OBS Live Producer
-> Backend tao/resume Cloudflare Live Input
-> status = waiting_for_obs
-> UI hien RTMPS URL + Stream Key
-> User copy vao OBS va Start Streaming
-> Cloudflare webhook/polling bao connected
-> status = source_connected hoac ready_to_go_live neu da co title/description
-> UI preview HLS
-> User nhap title + description
-> save-details
-> status = ready_to_go_live
-> Nut Phat truc tiep enabled
-> go-live API
-> verify owner + source + details + playback URL
-> status = live
-> tao LIVE post tren feed/profile
-> Viewer xem live
-> OBS stop / user end
-> status = ended/processing
-> video ready
-> archive MP4 sang R2
-> update replay post/library
-> delete Cloudflare Stream video sau khi R2 + DB + post thanh cong
````

## API / Edge Function

### `live-rtmp` actions

- `create`: verify auth, resume session chua ket thuc neu co, hoac tao Cloudflare Live Input moi.
- `status`: poll Cloudflare, set `source_connected`/`ready_to_go_live`, khong public feed post.
- `save-details`: validate/lua title va description bat buoc.
- `go-live`: verify owner + source + details + playback URL, set `live`, tao LIVE post.
- `reset-stream-key`: chan khi OBS connected/public live, tao key/input moi khi an toan.
- `end`: ket thuc live, update live post sang ended/processing.

## UI / UX

File chinh: `src/modules/live/pages/RtmpHostPage.tsx`

Layout moi:

- Header: Live Producer + status badge.
- Left sidebar: progress checklist 3 buoc.
- Main area: preview player, status cards, live post notice.
- Right panel: RTMPS URL, Stream Key, copy/reset, title/description required, nut **Phat truc tiep** gated.

## Bao mat

- Cloudflare API token khong expose ra frontend.
- R2 secret khong expose ra frontend.
- Stream Key encrypted bang server-side secret.
- Stream Key chi owner moi xem/copy.
- Khong log Stream Key.
- Webhook verify secret.
- Frontend chi goi Supabase Edge Function.

## Test checklist

### Flow chuan

1. User bam Live bang OBS.
2. Live Producer hien RTMPS URL + Stream Key.
3. Copy vao OBS Custom.
4. OBS Start Streaming.
5. UI buoc Ket noi nguon video completed.
6. Nhap title + description.
7. Buoc Hoan tat chi tiet completed.
8. Nut Phat truc tiep enabled.
9. Bam Phat truc tiep.
10. LIVE post xuat hien tren feed/profile.
11. Viewer xem duoc live.
12. Stop OBS.
13. Status ended/processing.
14. MP4 archive sang R2.
15. Replay post/live post replay cap nhat.
16. Cloudflare Stream video bi xoa sau archive thanh cong.

### Edge cases

- OBS ket noi truoc khi nhap title.
- Nhap title/description truoc roi OBS ket noi sau.
- Refresh browser khi OBS van stream.
- Dong tab khi OBS van stream.
- Reset stream key truoc khi OBS connected.
- Thu reset key khi source connected: phai bi chan.
- OBS disconnect truoc khi bam Phat truc tiep: khong tao public post.
- Bam Phat truc tiep khi playback URL chua ready: bi chan.
- R2 upload fail: giu Stream video, retry.
- Create post fail: khong delete Stream video.

## Rollback / retry

- Neu OBS chua public: chi can disable Live Input hoac xoa session draft, khong co feed post.
- Neu go-live fail: session van `source_connected/ready_to_go_live`, co the retry.
- Neu archive R2 fail: `archive_status = failed`, Stream video duoc giu lai, retry `retry-archive-replays`.
- Neu delete Stream fail sau R2: `stream_deleted_at` van null, retry cleanup sau.
- Migration chi add column/noi constraint, khong xoa du lieu cu.

## Verification

- `npm run build` da pass.
- `npm run lint` trong repo hien co co nhieu loi lint cu khong thuoc rieng flow nay, nen build la verification chinh cho thay doi frontend/type.

# Full Source Code
## Source: $file

````sql
-- RTMP/OBS Live Producer flow.
-- OBS may connect before the creator publishes. The session only becomes public
-- after the owner clicks Go Live with valid post details.

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS stream_key_last_reset_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS go_live_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replay_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;

UPDATE public.live_sessions
SET live_post_id = COALESCE(live_post_id, post_id)
WHERE mode = 'rtmp_obs'
  AND live_post_id IS NULL
  AND post_id IS NOT NULL;

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_status_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_status_check
  CHECK (status IN (
    'created',
    'waiting_for_obs',
    'source_connected',
    'ready_to_go_live',
    'live',
    'ended',
    'processing',
    'archiving',
    'posted',
    'failed'
  ));

CREATE INDEX IF NOT EXISTS idx_live_sessions_rtmp_producer_status
  ON public.live_sessions(host_user_id, status, updated_at DESC)
  WHERE mode = 'rtmp_obs' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_live_sessions_live_post_id
  ON public.live_sessions(live_post_id)
  WHERE live_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_live_sessions_replay_post_id
  ON public.live_sessions(replay_post_id)
  WHERE replay_post_id IS NOT NULL;

COMMENT ON COLUMN public.live_sessions.source_connected_at IS
  'Set when Cloudflare Stream Live Input first receives OBS/RTMP input. This does not mean the live is public.';

COMMENT ON COLUMN public.live_sessions.go_live_clicked_at IS
  'Set when the creator clicks Go Live in the Live Producer dashboard.';

````

## Source: $file

````ts
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildStreamPlaybackUrls,
  createLiveInput,
  disableLiveInput,
  getLiveInput,
  resolveLatestVideoUidForLiveInput,
} from "../_shared/cloudflareStreamService.ts";
import { decryptStreamKey, encryptStreamKey, maskStreamKey } from "../_shared/streamKeyCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SupabaseAdmin = ReturnType<typeof createClient>;
type RtmpStatus = "idle" | "waiting" | "live" | "ended";
type ProducerStatus =
  | "waiting_for_obs"
  | "source_connected"
  | "ready_to_go_live"
  | "live"
  | "ended"
  | "processing"
  | "archiving"
  | "posted"
  | "failed";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400) {
  return json({ error: message }, status);
}

function config() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Missing Supabase RTMP configuration");
  }
  return { supabaseUrl, anonKey, serviceRoleKey };
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return await req.json().catch(() => ({}));
  const text = await req.text();
  return text ? Object.fromEntries(new URLSearchParams(text).entries()) : {};
}

async function getUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await client.auth.getUser();
  return user ?? null;
}

async function mergePostMetadata(
  admin: SupabaseAdmin,
  postId: string,
  patch: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  const { data: post } = await admin.from("posts").select("metadata").eq("id", postId).maybeSingle();
  await admin
    .from("posts")
    .update({
      ...extra,
      metadata: {
        ...((post?.metadata || {}) as Record<string, unknown>),
        ...patch,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
}

function toResponse(row: Record<string, unknown>, options: { streamKey?: string | null; reveal?: boolean } = {}) {
  const liveInputId = String(row.cloudflare_live_input_id || "");
  const hlsUrl = String(
    row.hls_url ||
    row.hls_playback_url ||
    row.playback_url ||
    (liveInputId ? buildStreamPlaybackUrls(liveInputId).hls : ""),
  );
  const rawStatus = String(row.rtmp_status || "waiting") as RtmpStatus;

  return {
    live_session_id: row.id,
    status: rawStatus,
    app_status: row.status,
    rtmp_url: row.rtmps_url ?? null,
    rtmps_url: row.rtmps_url ?? null,
    stream_key: options.reveal ? options.streamKey : maskStreamKey(options.streamKey),
    hls_url: hlsUrl || null,
    playback_url: hlsUrl || null,
    live_mode: "rtmp_obs",
    mode: "rtmp_obs",
    stream_provider: "cloudflare_stream",
    cloudflare_live_input_id: liveInputId || null,
    title: row.title ?? "",
    description: row.description ?? "",
    source_connected_at: row.source_connected_at ?? null,
    go_live_clicked_at: row.go_live_clicked_at ?? null,
    live_post_id: row.live_post_id ?? row.post_id ?? null,
    replay_post_id: row.replay_post_id ?? null,
    rtmp_started_at: row.rtmp_started_at ?? null,
    started_at: row.started_at ?? null,
    recording_status: row.recording_status ?? null,
    archive_status: row.archive_status ?? null,
  };
}

function detailsAreValid(row: Record<string, unknown>) {
  return String(row.title || "").trim().length > 0 && String(row.description || "").trim().length > 0;
}

function producerStatusFor(row: Record<string, unknown>, connected: boolean): ProducerStatus {
  if (["live", "ended", "processing", "archiving", "posted", "failed"].includes(String(row.status))) {
    return String(row.status) as ProducerStatus;
  }
  if (!connected) return "waiting_for_obs";
  return detailsAreValid(row) ? "ready_to_go_live" : "source_connected";
}

async function createOrUpdateLivePost(params: {
  admin: SupabaseAdmin;
  live: Record<string, unknown>;
  userId: string;
  hlsUrl: string;
}) {
  const { admin, live, userId, hlsUrl } = params;
  const now = new Date().toISOString();
  const metadata = {
    live_session_id: live.id,
    live_title: String(live.title || "").trim(),
    title: String(live.title || "").trim(),
    description: String(live.description || "").trim(),
    live_status: "live",
    badge: "LIVE",
    media_type: "live_video",
    live_mode: "rtmp_obs",
    mode: "rtmp_obs",
    stream_provider: "cloudflare_stream",
    playback_provider: "cloudflare_stream",
    playback_url: hlsUrl,
    hls_url: hlsUrl,
    hls_playback_url: hlsUrl,
    cloudflare_live_input_id: live.cloudflare_live_input_id,
    viewer_count: live.viewer_count ?? 0,
    go_live_clicked_at: now,
  };

  const existingPostId = String(live.live_post_id || live.post_id || "");
  if (existingPostId) {
    await mergePostMetadata(admin, existingPostId, metadata, {
      content: String(live.title || "").trim(),
      video_url: hlsUrl,
      post_type: "live",
    });
    return existingPostId;
  }

  const { data: post, error: postError } = await admin
    .from("posts")
    .insert({
      user_id: userId,
      content: String(live.title || "").trim(),
      visibility: live.privacy === "friends" ? "friends" : "public",
      post_type: "live",
      video_url: hlsUrl,
      metadata,
    })
    .select("id")
    .single();
  if (postError) throw postError;
  return post.id as string;
}

async function requireOwnedRtmpSession(admin: SupabaseAdmin, sessionId: string, userId: string) {
  const { data, error: sessionError } = await admin
    .from("live_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!data) throw new Error("Live session not found");
  if (data.host_user_id !== userId && data.owner_id !== userId) throw new Error("Only host can manage this live session");
  if (data.mode !== "rtmp_obs" && data.live_mode !== "rtmp_obs" && data.stream_provider !== "cloudflare_stream") {
    throw new Error("Not a Cloudflare OBS live session");
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return error("Method not allowed", 405);

  try {
    const cfg = config();
    const body = await readBody(req);
    const action = String(body.action || "");
    const admin = createClient(cfg.supabaseUrl, cfg.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const user = await getUser(req, cfg.supabaseUrl, cfg.anonKey);
    if (!user) return error("Authorization required", 401);

    if (action === "create") {
      const { data: existing, error: existingError } = await admin
        .from("live_sessions")
        .select("*")
        .eq("host_user_id", user.id)
        .eq("mode", "rtmp_obs")
        .is("deleted_at", null)
        .in("status", ["waiting_for_obs", "source_connected", "ready_to_go_live", "live"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        const encryptedExistingKey = typeof existing.stream_key_encrypted === "string" ? existing.stream_key_encrypted : "";
        const existingKey = encryptedExistingKey ? await decryptStreamKey(encryptedExistingKey) : null;
        return json(toResponse(existing, { streamKey: existingKey, reveal: true }));
      }

      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();
      const privacy = body.privacy === "friends" ? "friends" : "public";
      const liveSessionId = crypto.randomUUID();
      const channelName = `obs_${user.id}_${Date.now()}`;
      const liveInput = await createLiveInput({
        liveSessionId,
        userId: user.id,
        title,
        description,
      });
      const streamKey = liveInput.rtmps?.streamKey ?? "";
      const rtmpsUrl = liveInput.rtmps?.url ?? "";
      const playback = liveInput.playback?.hls || buildStreamPlaybackUrls(liveInput.uid).hls;
      const now = new Date().toISOString();

      const { data, error: insertError } = await admin
        .from("live_sessions")
        .insert({
          id: liveSessionId,
          host_user_id: user.id,
          owner_id: user.id,
          channel_name: channelName,
          source: "rtmp",
          mode: "rtmp_obs",
          live_mode: "rtmp_obs",
          stream_provider: "cloudflare_stream",
          cloudflare_live_input_id: liveInput.uid,
          rtmps_url: rtmpsUrl,
          stream_key: null,
          stream_key_encrypted: await encryptStreamKey(streamKey),
          stream_key_last_shown_at: now,
          stream_key_last_reset_at: now,
          rtmp_status: "waiting",
          hls_url: playback,
          hls_playback_url: playback,
          playback_url: playback,
          storage_provider: "cloudflare_stream",
          playback_provider: "cloudflare_stream",
          title,
          description,
          privacy,
          status: "waiting_for_obs",
          recording_status: "idle",
          archive_status: "pending",
        })
        .select("*")
        .single();

      if (insertError) throw insertError;
      return json(toResponse(data, { streamKey, reveal: true }));
    }

    const sessionId = String(body.live_session_id || body.session_id || "");
    if (!sessionId) return error("live_session_id is required", 400);
    const row = await requireOwnedRtmpSession(admin, sessionId, user.id);
    const encryptedKey = typeof row.stream_key_encrypted === "string" ? row.stream_key_encrypted : "";
    const streamKey = encryptedKey ? await decryptStreamKey(encryptedKey) : null;

    if (action === "host-session" || action === "credentials" || action === "stream-credentials") {
      await admin
        .from("live_sessions")
        .update({ stream_key_last_shown_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", sessionId);
      return json(toResponse(row, { streamKey, reveal: true }));
    }

    if (action === "copy-stream-key") {
      await admin
        .from("live_sessions")
        .update({ stream_key_last_shown_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", sessionId);
      return json({ stream_key_with_password: streamKey });
    }

    if (action === "status" || action === "start") {
      if (row.cloudflare_live_input_id && row.status !== "ended") {
        try {
          const liveInput = await getLiveInput(row.cloudflare_live_input_id);
          const rawStatus = liveInput.status as unknown;
          const stateStr = String(
            (rawStatus && typeof rawStatus === "object"
              ? (rawStatus as { current?: { state?: string } }).current?.state
              : rawStatus) || "",
          ).toLowerCase();
          const isLive = ["connected", "reconnected", "live"].includes(stateStr);
          const isDisconnected = ["disconnected", "idle", "ended", "stopped"].includes(stateStr);
          const freshHls = liveInput.playback?.hls || null;
          const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (freshHls && freshHls !== row.hls_url) {
            patch.hls_url = freshHls;
            patch.hls_playback_url = freshHls;
            patch.playback_url = freshHls;
            row.hls_url = freshHls;
            row.hls_playback_url = freshHls;
            row.playback_url = freshHls;
          }
          if (isLive) {
            const now = new Date().toISOString();
            const nextStatus = producerStatusFor(row, true);
            patch.status = nextStatus;
            patch.rtmp_status = "live";
            patch.rtmp_started_at = row.rtmp_started_at ?? now;
            patch.source_connected_at = row.source_connected_at ?? now;
            patch.recording_status = "recording";
            row.status = nextStatus;
            row.rtmp_status = "live";
            row.rtmp_started_at = row.rtmp_started_at ?? now;
            row.source_connected_at = row.source_connected_at ?? now;
            row.recording_status = "recording";
          } else if (isDisconnected && row.rtmp_status === "live") {
            if (row.status === "live") {
              const now = new Date().toISOString();
              patch.status = "ended";
              patch.rtmp_status = "ended";
              patch.ended_at = row.ended_at ?? now;
              patch.rtmp_ended_at = row.rtmp_ended_at ?? now;
              patch.recording_status = "processing";
              row.status = "ended";
              row.rtmp_status = "ended";
            } else {
              patch.status = "waiting_for_obs";
              patch.rtmp_status = "waiting";
              row.status = "waiting_for_obs";
              row.rtmp_status = "waiting";
            }
          }

          // Link cloudflare_video_uid as soon as Cloudflare exposes a recorded video
          // for this Live Input. Without it the archive pipeline cannot run.
          if (!row.cloudflare_video_uid) {
            const latestVideoUid = await resolveLatestVideoUidForLiveInput(row.cloudflare_live_input_id);
            if (latestVideoUid) {
              patch.cloudflare_video_uid = latestVideoUid;
              row.cloudflare_video_uid = latestVideoUid;
            }
          }
          if (Object.keys(patch).length > 1) {
            await admin.from("live_sessions").update(patch).eq("id", sessionId);
          }
        } catch (err) {
          console.warn("[live-rtmp] getLiveInput failed", err);
        }
      }
      return json(toResponse(row, { streamKey, reveal: false }));
    }

    if (action === "save-details" || action === "update-details") {
      if (row.status === "ended" || row.status === "posted") return error("Cannot update details after live ended", 409);
      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();
      if (!title) return error("Title is required", 400);
      if (!description) return error("Description is required", 400);
      const connected = row.rtmp_status === "live" || row.status === "source_connected" || row.status === "ready_to_go_live" || row.status === "live";
      const nextStatus = row.status === "live" ? "live" : connected ? "ready_to_go_live" : "waiting_for_obs";
      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await admin
        .from("live_sessions")
        .update({
          title,
          description,
          status: nextStatus,
          updated_at: now,
        })
        .eq("id", sessionId)
        .select("*")
        .single();
      if (updateError) throw updateError;
      return json(toResponse(updated, { streamKey, reveal: false }));
    }

    if (action === "go-live" || action === "go_live") {
      const title = String(row.title || "").trim();
      const description = String(row.description || "").trim();
      if (!title) return error("Title is required before going live", 400);
      if (!description) return error("Description is required before going live", 400);
      if (row.rtmp_status !== "live" && row.status !== "source_connected" && row.status !== "ready_to_go_live") {
        return error("OBS source is not connected", 409);
      }
      const hlsUrl = String(row.hls_url || row.hls_playback_url || row.playback_url || "");
      if (!hlsUrl) return error("Playback URL is not ready yet", 409);

      const now = new Date().toISOString();
      const livePostId = await createOrUpdateLivePost({ admin, live: row, userId: user.id, hlsUrl });
      const { data: updated, error: updateError } = await admin
        .from("live_sessions")
        .update({
          status: "live",
          rtmp_status: "live",
          started_at: row.started_at ?? now,
          go_live_clicked_at: row.go_live_clicked_at ?? now,
          source_connected_at: row.source_connected_at ?? now,
          live_post_id: livePostId,
          post_id: livePostId,
          playback_url: hlsUrl,
          hls_url: hlsUrl,
          hls_playback_url: hlsUrl,
          recording_status: "recording",
          updated_at: now,
        })
        .eq("id", sessionId)
        .select("*")
        .single();
      if (updateError) throw updateError;
      return json({ ...toResponse(updated, { streamKey, reveal: false }), live_post_id: livePostId });
    }

    if (action === "regenerate" || action === "reset-stream-key") {
      if (row.status === "live" || row.rtmp_status === "live" || row.status === "source_connected" || row.status === "ready_to_go_live") {
        return error("Cannot reset stream key while OBS is connected or live", 409);
      }
      if (row.status === "ended") return error("Cannot reset stream key after live ended", 409);

      if (row.cloudflare_live_input_id) {
        await disableLiveInput(row.cloudflare_live_input_id).catch((err) => {
          console.warn("[live-rtmp] disable old Live Input failed", err);
        });
      }

      const liveInput = await createLiveInput({
        liveSessionId: sessionId,
        userId: user.id,
        title: String(row.title || ""),
        description: String(row.description || ""),
      });
      const nextKey = liveInput.rtmps?.streamKey ?? "";
      const rtmpsUrl = liveInput.rtmps?.url ?? "";
      const playback = liveInput.playback?.hls || buildStreamPlaybackUrls(liveInput.uid).hls;
      const now = new Date().toISOString();

      const { data: updated, error: updateError } = await admin
        .from("live_sessions")
        .update({
          cloudflare_live_input_id: liveInput.uid,
          rtmps_url: rtmpsUrl,
          stream_key: null,
          stream_key_encrypted: await encryptStreamKey(nextKey),
          stream_key_last_shown_at: now,
          stream_key_last_reset_at: now,
          rtmp_status: "waiting",
          status: "waiting_for_obs",
          source_connected_at: null,
          go_live_clicked_at: null,
          cloudflare_video_uid: null,
          hls_url: playback,
          hls_playback_url: playback,
          playback_url: playback,
          updated_at: now,
        })
        .eq("id", sessionId)
        .select("*")
        .single();
      if (updateError) throw updateError;
      return json(toResponse(updated, { streamKey: nextKey, reveal: true }));
    }

    if (action === "end") {
      const now = new Date().toISOString();
      if (row.cloudflare_live_input_id) {
        await disableLiveInput(row.cloudflare_live_input_id).catch((err) => {
          console.warn("[live-rtmp] disable Live Input failed", err);
        });
      }

      await admin
        .from("live_sessions")
        .update({
          status: "ended",
          rtmp_status: "ended",
          ended_at: row.ended_at ?? now,
          rtmp_ended_at: row.rtmp_ended_at ?? now,
          recording_status: row.cloudflare_video_uid ? "processing" : "processing",
          archive_status: row.archive_status ?? "pending",
          updated_at: now,
        })
        .eq("id", sessionId);

      if (row.post_id) {
        await mergePostMetadata(admin, row.post_id, {
          live_session_id: row.id,
          live_status: "ended",
          live_mode: "rtmp_obs",
          mode: "rtmp_obs",
          stream_provider: "cloudflare_stream",
          replay_status: "processing",
          archive_status: row.archive_status ?? "pending",
          ended_at: row.ended_at ?? now,
        });
      }

      return json({ ok: true, status: "ended", live_session_id: sessionId });
    }

    return error("Unknown RTMP live action", 404);
  } catch (err) {
    console.error("[live-rtmp]", err);
    return error(err instanceof Error ? err.message : "Unknown error", 500);
  }
});


````

## Source: $file

````ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { archiveReplayToR2 } from "../_shared/archiveReplay.ts";
import { resolveLatestVideoUidForLiveInput } from "../_shared/cloudflareStreamService.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, webhook-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseSignature(header: string): { time: string; sig1: string } | null {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
  if (!parts.time || !parts.sig1) return null;
  return { time: parts.time, sig1: parts.sig1 };
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function verifySignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const parsed = parseSignature(header);
  if (!parsed) return false;

  const timestamp = Number(parsed.time);
  if (!Number.isFinite(timestamp)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parsed.time}.${rawBody}`)),
  );
  return constantTimeEqual(expected, parsed.sig1);
}

function buildUrls(uid: string, customerCode: string) {
  const base = customerCode
    ? `https://customer-${customerCode}.cloudflarestream.com/${uid}`
    : `https://videodelivery.net/${uid}`;
  return {
    hls: `${base}/manifest/video.m3u8`,
    dash: `${base}/manifest/video.mpd`,
    mp4: `${base}/downloads/default.mp4`,
    thumbnail: `${base}/thumbnails/thumbnail.jpg?time=3s`,
  };
}

function stringFrom(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function liveInputIdFromPayload(payload: Record<string, unknown>): string {
  const direct = [
    payload.liveInput,
    payload.live_input,
    payload.liveInputUID,
    payload.liveInputUid,
    payload.live_input_uid,
  ].map(stringFrom).find(Boolean);
  if (direct) return direct;

  const input = payload.input && typeof payload.input === "object" ? payload.input as Record<string, unknown> : null;
  const nested = input ? [input.uid, input.id].map(stringFrom).find(Boolean) : "";
  if (nested) return nested;

  const meta = payload.meta && typeof payload.meta === "object" ? payload.meta as Record<string, unknown> : null;
  return meta ? [meta.live_input_id, meta.cloudflare_live_input_id].map(stringFrom).find(Boolean) || "" : "";
}

function eventNameFromPayload(payload: Record<string, unknown>): string {
  return [
    payload.event,
    payload.type,
    payload.name,
    payload.eventType,
    payload.event_type,
    payload.status && typeof payload.status === "object" ? (payload.status as Record<string, unknown>).state : "",
  ].map(stringFrom).find(Boolean)?.toLowerCase() || "";
}

async function mergePostMetadata(
  supabase: ReturnType<typeof createClient>,
  postId: string,
  patch: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  const { data: post } = await supabase.from("posts").select("metadata").eq("id", postId).maybeSingle();
  await supabase
    .from("posts")
    .update({
      ...extra,
      metadata: {
        ...((post?.metadata || {}) as Record<string, unknown>),
        ...patch,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
}

async function ensureLivePostForObs(
  supabase: ReturnType<typeof createClient>,
  live: Record<string, unknown>,
  playbackHls: string,
) {
  const now = new Date().toISOString();
  const metadata = {
    live_session_id: live.id,
    live_title: live.title,
    live_status: "live",
    live_mode: "rtmp_obs",
    mode: "rtmp_obs",
    stream_provider: "cloudflare_stream",
    cloudflare_live_input_id: live.cloudflare_live_input_id,
    hls_url: playbackHls,
    hls_playback_url: playbackHls,
    playback_url: playbackHls,
    viewer_count: live.viewer_count ?? 0,
  };

  if (live.post_id) {
    await mergePostMetadata(supabase, String(live.post_id), metadata, { video_url: null });
    return String(live.post_id);
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: live.host_user_id || live.owner_id,
      content: live.title || "Dang LIVE bang OBS tren FUN Profile",
      visibility: live.privacy === "friends" ? "friends" : "public",
      post_type: "live",
      video_url: null,
      metadata,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase
    .from("live_sessions")
    .update({ post_id: post.id, posted_at: now, updated_at: now })
    .eq("id", live.id);
  return post.id;
}

async function handleObsLiveEvent(params: {
  supabase: ReturnType<typeof createClient>;
  payload: Record<string, unknown>;
  liveInputId: string;
  eventName: string;
  customerCode: string;
}) {
  const { supabase, payload, liveInputId, eventName, customerCode } = params;
  const isConnected =
    eventName.includes("connected") ||
    eventName.includes("live_input.connected") ||
    eventName.includes("live.connected");
  const isDisconnected =
    eventName.includes("disconnected") ||
    eventName.includes("live_input.disconnected") ||
    eventName.includes("live.disconnected");

  if (!liveInputId || (!isConnected && !isDisconnected)) return false;

  const { data: live, error } = await supabase
    .from("live_sessions")
    .select("*")
    .eq("cloudflare_live_input_id", liveInputId)
    .maybeSingle();
  if (error) throw error;
  if (!live) return true;

  const now = new Date().toISOString();
  const playbackHls =
    stringFrom(payload.playback && typeof payload.playback === "object" ? (payload.playback as Record<string, unknown>).hls : "") ||
    buildUrls(liveInputId, customerCode).hls;

  if (isConnected) {
    const hasDetails = String(live.title || "").trim().length > 0 && String(live.description || "").trim().length > 0;
    const nextStatus = live.status === "live" ? "live" : hasDetails ? "ready_to_go_live" : "source_connected";
    await supabase
      .from("live_sessions")
      .update({
        status: nextStatus,
        rtmp_status: "live",
        rtmp_started_at: live.rtmp_started_at ?? now,
        source_connected_at: live.source_connected_at ?? now,
        recording_status: "recording",
        playback_url: playbackHls,
        hls_url: playbackHls,
        hls_playback_url: playbackHls,
        updated_at: now,
      })
      .eq("id", live.id);
    if (live.status === "live" && (live.live_post_id || live.post_id)) {
      await mergePostMetadata(supabase, String(live.live_post_id || live.post_id), {
        live_session_id: live.id,
        live_status: "live",
        replay_status: null,
        archive_status: "pending",
        hls_url: playbackHls,
        hls_playback_url: playbackHls,
        playback_url: playbackHls,
      });
    }
    return true;
  }

  if (isDisconnected) {
    // Try to link the recorded video UID immediately so archive pipeline can run.
    let resolvedVideoUid: string | null = stringFrom(live.cloudflare_video_uid);
    if (!resolvedVideoUid) {
      resolvedVideoUid = await resolveLatestVideoUidForLiveInput(liveInputId);
    }

    const wasPublic = live.status === "live" || !!live.go_live_clicked_at || !!live.live_post_id || !!live.post_id;
    await supabase
      .from("live_sessions")
      .update({
        status: wasPublic ? "ended" : "waiting_for_obs",
        rtmp_status: "ended",
        rtmp_ended_at: live.rtmp_ended_at ?? now,
        ended_at: wasPublic ? live.ended_at ?? now : live.ended_at,
        recording_status: wasPublic ? "processing" : "idle",
        archive_status: "pending",
        cloudflare_video_uid: resolvedVideoUid ?? live.cloudflare_video_uid ?? null,
        updated_at: now,
      })
      .eq("id", live.id);

    if (wasPublic && (live.live_post_id || live.post_id)) {
      await mergePostMetadata(supabase, String(live.live_post_id || live.post_id), {
        live_session_id: live.id,
        live_status: "ended",
        live_mode: "rtmp_obs",
        mode: "rtmp_obs",
        stream_provider: "cloudflare_stream",
        replay_status: "processing",
        archive_status: "pending",
        ended_at: live.ended_at ?? now,
        cloudflare_video_uid: resolvedVideoUid ?? live.cloudflare_video_uid ?? null,
      });
    }

    // Kick off archive pipeline ASAP (non-blocking on failure â€” retry-archive-replays will catch up).
    if (wasPublic && resolvedVideoUid) {
      archiveReplayToR2({ supabase, liveSessionId: String(live.id) }).catch((err) => {
        console.warn("[stream-webhook] archiveReplayToR2 (disconnected) failed", err);
      });
    }
    return true;
  }

  return false;
}

/**
 * Enable MP4 downloads on a Cloudflare Stream video.
 * Returns { url, ready } â€” `url` is the MP4 download URL when status is "ready",
 * otherwise null. Cloudflare may take a few minutes to render.
 */
async function enableMp4Download(uid: string): Promise<{ url: string | null; ready: boolean }> {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
  const apiToken = Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN") ?? "";
  if (!accountId || !apiToken) {
    console.warn("[enableMp4Download] Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_STREAM_API_TOKEN");
    return { url: null, ready: false };
  }
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
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(`[enableMp4Download] HTTP ${res.status}`, json);
      return { url: null, ready: false };
    }
    const def = json?.result?.default;
    const url = typeof def?.url === "string" ? def.url : null;
    const ready = def?.status === "ready";
    return { url: ready ? url : null, ready };
  } catch (err) {
    console.warn("[enableMp4Download] error", err);
    return { url: null, ready: false };
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const rawBody = await req.text();
    const webhookSecret =
      Deno.env.get("CLOUDFLARE_WEBHOOK_SECRET") ??
      Deno.env.get("CLOUDFLARE_STREAM_WEBHOOK_SECRET") ??
      "";

    // Bootstrap mode: secret chua duoc cau hinh -> tra 200 de Cloudflare reveal secret.
    // KHONG ghi DB vi payload chua duoc xac thuc.
    if (!webhookSecret) {
      console.warn("[stream-webhook] BOOTSTRAP MODE: CLOUDFLARE_STREAM_WEBHOOK_SECRET is not set. Skipping signature verification and DB writes.");
      return json({ ok: true, bootstrap: true, message: "Set CLOUDFLARE_STREAM_WEBHOOK_SECRET to enable processing." });
    }

    const ok = await verifySignature(rawBody, req.headers.get("Webhook-Signature"), webhookSecret);
    if (!ok) return json({ error: "Invalid webhook signature" }, 401);

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const liveInputId = liveInputIdFromPayload(payload);
    const eventName = eventNameFromPayload(payload);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const customerCode = Deno.env.get("CLOUDFLARE_STREAM_CUSTOMER_CODE") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase configuration" }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const handledLiveEvent = await handleObsLiveEvent({
      supabase,
      payload,
      liveInputId,
      eventName,
      customerCode,
    });
    if (handledLiveEvent) return json({ ok: true, event: eventName || "live_input" });

    const uid = String(payload.uid || "");
    if (!uid) return json({ error: "Missing uid" }, 400);

    const { data: existingReplay, error: replayError } = await supabase
      .from("live_replays")
      .select("id, live_session_id")
      .eq("stream_uid", uid)
      .maybeSingle();
    if (replayError) throw replayError;
    let replay = existingReplay;
    if (!replay) {
      const meta = (payload.meta && typeof payload.meta === "object")
        ? payload.meta as Record<string, unknown>
        : {};
      const liveSessionId = typeof meta.live_session_id === "string" ? meta.live_session_id : "";
      const userId = typeof meta.user_id === "string" ? meta.user_id : "";

      if (!liveSessionId || !userId) {
        if (!liveInputId) return json({ ok: true, ignored: "unknown uid" });
        const { data: liveByInput, error: liveByInputError } = await supabase
          .from("live_sessions")
          .select("id, host_user_id, owner_id")
          .eq("cloudflare_live_input_id", liveInputId)
          .maybeSingle();
        if (liveByInputError) throw liveByInputError;
        if (!liveByInput?.id || (!liveByInput.host_user_id && !liveByInput.owner_id)) {
          return json({ ok: true, ignored: "unknown uid" });
        }
        meta.live_session_id = liveByInput.id;
        meta.user_id = liveByInput.host_user_id || liveByInput.owner_id;
      }

      const resolvedLiveSessionId = typeof meta.live_session_id === "string" ? meta.live_session_id : "";
      const resolvedUserId = typeof meta.user_id === "string" ? meta.user_id : "";

      const { data: insertedReplay, error: insertReplayError } = await supabase
        .from("live_replays")
        .insert({
          user_id: resolvedUserId,
          live_session_id: resolvedLiveSessionId,
          stream_uid: uid,
          status: "processing",
        })
        .select("id, live_session_id")
        .single();
      if (insertReplayError) throw insertReplayError;
      replay = insertedReplay;
    }

    const statusPayload = payload.status && typeof payload.status === "object"
      ? payload.status as Record<string, unknown>
      : {};
    const playbackPayload = payload.playback && typeof payload.playback === "object"
      ? payload.playback as Record<string, unknown>
      : {};
    const state = String(statusPayload.state || "");
    const errorText =
      statusPayload.errorReasonText ||
      statusPayload.errReasonText ||
      statusPayload.errorReasonCode ||
      statusPayload.errReasonCode ||
      "";

    const isVideoReady =
      payload.readyToStream === true &&
      (!state || ["ready", "live-inprogress"].includes(state.toLowerCase()));

    if (isVideoReady) {
      const urls = buildUrls(uid, customerCode);
      const playbackHls = String(playbackPayload.hls || urls.hls);
      const playbackDash = String(playbackPayload.dash || urls.dash);
      const thumbnailUrl = String(payload.thumbnail || urls.thumbnail);
      const durationSeconds = Number.isFinite(Number(payload.duration))
        ? Math.round(Number(payload.duration))
        : null;
      const size = Number.isFinite(Number(payload.size)) ? Number(payload.size) : null;

      // Kick off MP4 render. URL only stored when CF reports status === "ready".
      const mp4 = await enableMp4Download(uid);
      const playbackMp4: string | null = mp4.url;

      const { data: updatedReplay, error: updateError } = await supabase
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
        .eq("id", replay.id)
        .select("live_session_id")
        .single();
      if (updateError) throw updateError;

      const { data: live } = await supabase
        .from("live_sessions")
        .select("id, post_id, live_post_id, status, go_live_clicked_at")
        .eq("id", updatedReplay.live_session_id)
        .maybeSingle();
      const wasPublic = live?.status === "live" || live?.status === "ended" || !!live?.go_live_clicked_at || !!live?.live_post_id || !!live?.post_id;

      if (wasPublic && (live?.live_post_id || live?.post_id)) {
        const livePostId = live.live_post_id || live.post_id;
        const { data: post } = await supabase
          .from("posts")
          .select("metadata")
          .eq("id", livePostId)
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
          .eq("id", livePostId);
      }


      await supabase
        .from("live_sessions")
        .update({
          recording_status: "ready",
          status: wasPublic ? "processing" : "waiting_for_obs",
          archive_status: "pending",
          cloudflare_playback_url: playbackHls,
          cloudflare_mp4_download_url: playbackMp4,
          recording_ready_at: new Date().toISOString(),
          cloudflare_video_uid: uid,
          recording_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", updatedReplay.live_session_id);

      if (wasPublic) {
        await archiveReplayToR2({ supabase, replayId: replay.id });
      }
    } else if (state === "error") {
      await supabase
        .from("live_replays")
        .update({
          status: "failed",
          error_message: errorText || "Cloudflare Stream processing failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", replay.id);

      await supabase
        .from("live_sessions")
        .update({
          recording_status: "failed",
          cloudflare_video_uid: uid,
          recording_error: errorText || "Cloudflare Stream processing failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", replay.live_session_id);
    } else {
      await supabase
        .from("live_replays")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", replay.id)
        .in("status", ["uploading", "queued", "processing"]);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("[stream-webhook]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

````

## Source: $file

````ts
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { deleteCloudflareStreamUid } from "./postVideoDelete.ts";

type ArchiveResult = {
  ok: boolean;
  status: "archived" | "mp4_pending" | "failed" | "skipped";
  replay_id?: string;
  live_session_id?: string;
  r2_object_key?: string | null;
  r2_video_url?: string | null;
  error?: string;
};

type R2Env = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
  endpoint: string;
};

type StreamEnv = {
  accountId: string;
  token: string;
};

const SERVICE = "s3";
const REGION = "auto";

function nowIso() {
  return new Date().toISOString();
}

function stringFromUnknown(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getStreamEnv(): StreamEnv {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
  const token =
    Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN") ??
    Deno.env.get("CLOUDFLARE_STREAM_TOKEN") ??
    Deno.env.get("CLOUDFLARE_API_TOKEN") ??
    "";
  if (!accountId || !token) throw new Error("Missing Cloudflare Stream configuration");
  return { accountId, token };
}

function getR2Env(): R2Env {
  const accountId = Deno.env.get("R2_ACCOUNT_ID") ?? Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") ?? Deno.env.get("CLOUDFLARE_ACCESS_KEY_ID") ?? "";
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? Deno.env.get("CLOUDFLARE_SECRET_ACCESS_KEY") ?? "";
  const bucketName = Deno.env.get("R2_BUCKET_NAME") ?? Deno.env.get("CLOUDFLARE_R2_BUCKET_NAME") ?? "";
  const endpoint = (Deno.env.get("R2_ENDPOINT") ?? `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
  const publicUrl = (
    Deno.env.get("R2_PUBLIC_DOMAIN") ??
    Deno.env.get("CLOUDFLARE_R2_PUBLIC_URL") ??
    ""
  ).replace(/\/+$/, "");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    throw new Error("Missing Cloudflare R2 archive configuration");
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, endpoint, publicUrl };
}

function addDays(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function getBackoffSeconds(attempts: number): number {
  return Math.min(6 * 60 * 60, Math.max(60, 2 ** Math.min(attempts, 8) * 60));
}

function sanitizePath(value: string) {
  return value.replace(/[^a-zA-Z0-9._/-]/g, "-").replace(/\/+/g, "/").replace(/^\/+/, "");
}

function encodePath(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

async function sha256Hex(input: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

async function getSignatureKey(secret: string, dateStamp: string): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode("AWS4" + secret).buffer, dateStamp);
  const kRegion = await hmacSha256(kDate, REGION);
  const kService = await hmacSha256(kRegion, SERVICE);
  return hmacSha256(kService, "aws4_request");
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function signedR2Fetch(params: {
  method: "PUT" | "HEAD";
  key: string;
  body?: BodyInit | null;
  contentType?: string;
  contentLength?: string | null;
}) {
  const env = getR2Env();
  const host = new URL(env.endpoint).host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const canonicalUri = `/${env.bucketName}/${encodePath(params.key)}`;
  const signedHeaders = "host";
  const canonicalHeaders = `host:${host}\n`;
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${env.accessKeyId}/${dateStamp}/${REGION}/${SERVICE}/aws4_request`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": "900",
    "X-Amz-SignedHeaders": signedHeaders,
  });
  query.sort();
  const canonicalRequest = [
    params.method,
    canonicalUri,
    query.toString(),
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = await getSignatureKey(env.secretAccessKey, dateStamp);
  const signature = hex(await hmacSha256(signingKey, stringToSign));
  query.append("X-Amz-Signature", signature);

  const headers = new Headers();
  if (params.contentType) headers.set("content-type", params.contentType);

  return fetch(`${env.endpoint}${canonicalUri}?${query.toString()}`, {
    method: params.method,
    headers,
    body: params.body,
  });
}

async function fetchOrCreateMp4(uid: string): Promise<{ url: string | null; status: string | null }> {
  const env = getStreamEnv();
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.accountId}/stream/${uid}/downloads`;

  for (const method of ["GET", "POST"] as const) {
    const res = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 404) {
      throw new Error(`Cloudflare MP4 ${method} failed: ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
    }
    const def = body?.result?.default;
    const status = typeof def?.status === "string" ? def.status : null;
    const url = typeof def?.url === "string" ? def.url : null;
    if (status) return { status, url: status === "ready" ? url : null };
  }

  return { status: null, url: null };
}

async function markArchiveFailure(
  supabase: SupabaseClient,
  replay: Record<string, unknown>,
  message: string,
) {
  const attempts = Number(replay.archive_attempts || 0) + 1;
  const nextRetry = addDays(getBackoffSeconds(attempts));
  const now = nowIso();

  await supabase
    .from("live_replays")
    .update({
      archive_status: "failed",
      archive_error: message,
      archive_attempts: attempts,
      next_archive_retry_at: nextRetry,
      updated_at: now,
    })
    .eq("id", replay.id);

  if (replay.live_session_id) {
    await supabase
      .from("live_sessions")
      .update({
        archive_status: "failed",
        archive_error: message,
        updated_at: now,
      })
      .eq("id", replay.live_session_id);
  }
}

export async function archiveReplayToR2(params: {
  supabase: SupabaseClient;
  replayId?: string;
  liveSessionId?: string;
}): Promise<ArchiveResult> {
  let query = params.supabase
    .from("live_replays")
    .select("*");

  if (params.replayId) query = query.eq("id", params.replayId);
  else if (params.liveSessionId) query = query.eq("live_session_id", params.liveSessionId).order("created_at", { ascending: false }).limit(1);
  else return { ok: false, status: "failed", error: "replayId or liveSessionId required" };

  let { data: replay, error: replayError } = await query.maybeSingle();
  if (replayError) throw replayError;

  // OBS/RTMP path: a live_session may finish before any live_replays row exists.
  // If we have the session's cloudflare_video_uid, lazily create the replay row
  // so the rest of the pipeline can proceed unchanged.
  if (!replay && params.liveSessionId) {
    const { data: sess, error: sessErr } = await params.supabase
      .from("live_sessions")
      .select("id, host_user_id, owner_id, cloudflare_video_uid, cloudflare_playback_url, cloudflare_mp4_download_url")
      .eq("id", params.liveSessionId)
      .maybeSingle();
    if (sessErr) throw sessErr;
    const uidFromSession = stringFromUnknown(sess?.cloudflare_video_uid);
    const ownerId = stringFromUnknown(sess?.host_user_id) || stringFromUnknown(sess?.owner_id);
    if (sess?.id && uidFromSession && ownerId) {
      const { data: inserted, error: insertErr } = await params.supabase
        .from("live_replays")
        .insert({
          user_id: ownerId,
          live_session_id: sess.id,
          stream_uid: uidFromSession,
          status: "processing",
          archive_status: "pending",
          cloudflare_playback_url: sess.cloudflare_playback_url ?? null,
          cloudflare_mp4_download_url: sess.cloudflare_mp4_download_url ?? null,
        })
        .select("*")
        .single();
      if (insertErr) throw insertErr;
      replay = inserted;
    }
  }

  if (!replay) return { ok: false, status: "failed", error: "Replay not found" };

  if (replay.archive_status === "archived" && replay.stream_deleted_at) {
    return {
      ok: true,
      status: "skipped",
      replay_id: replay.id,
      live_session_id: replay.live_session_id,
      r2_object_key: replay.r2_object_key,
      r2_video_url: replay.r2_video_url,
    };
  }

  const uid = String(replay.stream_uid || "");
  if (!uid) {
    await markArchiveFailure(params.supabase, replay, "Missing Cloudflare Stream UID");
    return { ok: false, status: "failed", replay_id: replay.id, error: "Missing Cloudflare Stream UID" };
  }

  const { data: live, error: liveError } = await params.supabase
    .from("live_sessions")
    .select("id, post_id, live_post_id, replay_post_id, host_user_id, owner_id, title, cloudflare_video_uid")
    .eq("id", replay.live_session_id)
    .maybeSingle();
  if (liveError) throw liveError;

  const userId = String(replay.user_id || live?.host_user_id || live?.owner_id || "");
  if (!userId) {
    await markArchiveFailure(params.supabase, replay, "Missing replay owner");
    return { ok: false, status: "failed", replay_id: replay.id, error: "Missing replay owner" };
  }

  const alreadyArchivedToR2 =
    replay.storage_provider === "r2" &&
    replay.playback_provider === "r2" &&
    typeof replay.r2_object_key === "string" &&
    typeof replay.r2_video_url === "string";

  if (alreadyArchivedToR2 && !replay.stream_deleted_at) {
    const head = await signedR2Fetch({ method: "HEAD", key: String(replay.r2_object_key) });
    if (!head.ok) {
      const message = `R2 verify failed before Stream cleanup: ${head.status}`;
      await markArchiveFailure(params.supabase, replay, message);
      return { ok: false, status: "failed", replay_id: replay.id, error: message };
    }

    try {
      await deleteCloudflareStreamUid(uid);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markArchiveFailure(params.supabase, replay, message);
      return { ok: false, status: "failed", replay_id: replay.id, error: message };
    }

    const streamDeletedAt = nowIso();
    await params.supabase
      .from("live_replays")
      .update({
        archive_status: "archived",
        archive_error: null,
        stream_deleted_at: streamDeletedAt,
        updated_at: streamDeletedAt,
      })
      .eq("id", replay.id);

    if (live?.id) {
      await params.supabase
        .from("live_sessions")
        .update({
          archive_status: "archived",
          archive_error: null,
          stream_deleted_at: streamDeletedAt,
          updated_at: streamDeletedAt,
        })
        .eq("id", live.id);
    }

    if (live?.post_id) {
      const { data: post } = await params.supabase
        .from("posts")
        .select("metadata")
        .eq("id", live.post_id)
        .maybeSingle();
      const metadata = {
        ...((post?.metadata as Record<string, unknown> | null) || {}),
        archive_status: "archived",
        stream_deleted_at: streamDeletedAt,
      };
      await params.supabase.from("posts").update({ metadata, updated_at: streamDeletedAt }).eq("id", live.post_id);
    }

    return {
      ok: true,
      status: "archived",
      replay_id: replay.id,
      live_session_id: replay.live_session_id,
      r2_object_key: String(replay.r2_object_key),
      r2_video_url: String(replay.r2_video_url),
    };
  }

  const now = nowIso();
  await params.supabase
    .from("live_replays")
    .update({
      archive_status: "archiving",
      archive_error: null,
      processing_started_at: replay.processing_started_at ?? now,
      archive_attempts: Number(replay.archive_attempts || 0) + 1,
      updated_at: now,
    })
    .eq("id", replay.id);

  if (live?.id) {
    await params.supabase
      .from("live_sessions")
      .update({
        archive_status: "archiving",
        archive_error: null,
        processing_started_at: replay.processing_started_at ?? now,
        recording_status: "processing",
        updated_at: now,
      })
      .eq("id", live.id);
  }

  let mp4: { url: string | null; status: string | null };
  try {
    mp4 = await fetchOrCreateMp4(uid);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markArchiveFailure(params.supabase, replay, message);
    return { ok: false, status: "failed", replay_id: replay.id, error: message };
  }

  if (!mp4.url) {
    const attempts = Number(replay.archive_attempts || 0) + 1;
    const nextRetry = addDays(getBackoffSeconds(attempts));
    await params.supabase
      .from("live_replays")
      .update({
        archive_status: "mp4_pending",
        cloudflare_mp4_download_url: mp4.url,
        archive_error: null,
        next_archive_retry_at: nextRetry,
        updated_at: nowIso(),
      })
      .eq("id", replay.id);

    if (live?.id) {
      await params.supabase
        .from("live_sessions")
        .update({
          archive_status: "mp4_pending",
          cloudflare_mp4_download_url: mp4.url,
          archive_error: null,
          updated_at: nowIso(),
        })
        .eq("id", live.id);
    }

    return { ok: true, status: "mp4_pending", replay_id: replay.id, live_session_id: replay.live_session_id };
  }

  const download = await fetch(mp4.url);
  if (!download.ok || !download.body) {
    const message = `Cloudflare MP4 download failed: ${download.status}`;
    await markArchiveFailure(params.supabase, replay, message);
    return { ok: false, status: "failed", replay_id: replay.id, error: message };
  }

  const r2Env = getR2Env();
  const key = sanitizePath(
    String(replay.r2_object_key || `videos/${userId}/live-replays/${replay.live_session_id}/${uid}.mp4`),
  );
  const contentLength = download.headers.get("content-length");

  const put = await signedR2Fetch({
    method: "PUT",
    key,
    body: download.body,
    contentType: "video/mp4",
    contentLength,
  });
  if (!put.ok) {
    const detail = await put.text().catch(() => "");
    const message = `R2 upload failed: ${put.status} ${detail.slice(0, 300)}`;
    await markArchiveFailure(params.supabase, replay, message);
    return { ok: false, status: "failed", replay_id: replay.id, error: message };
  }

  const head = await signedR2Fetch({ method: "HEAD", key });
  if (!head.ok) {
    const message = `R2 verify failed: ${head.status}`;
    await markArchiveFailure(params.supabase, replay, message);
    return { ok: false, status: "failed", replay_id: replay.id, error: message };
  }

  const r2VideoUrl = `${r2Env.publicUrl}/${key}`;
  const archivedAt = nowIso();
  const metadataPatch = {
    live_status: "ended",
    replay_status: "ready",
    playback_type: "r2",
    storage_provider: "r2",
    playback_provider: "r2",
    playback_url: r2VideoUrl,
    playback_mp4: r2VideoUrl,
    r2_video_url: r2VideoUrl,
    r2_object_key: key,
    r2_bucket: r2Env.bucketName,
    stream_uid: uid,
    cloudflare_video_uid: uid,
    cloudflare_playback_url: replay.playback_hls ?? replay.cloudflare_playback_url ?? null,
    cloudflare_mp4_download_url: mp4.url,
    archived_at: archivedAt,
    archive_status: "archived",
    thumbnail_url: replay.thumbnail_url ?? null,
    duration_seconds: replay.duration_seconds ?? null,
  };

  await params.supabase
    .from("live_replays")
    .update({
      status: "ready",
      storage_provider: "r2",
      playback_provider: "r2",
      archive_status: "posting",
      archive_error: null,
      cloudflare_playback_url: replay.playback_hls ?? replay.cloudflare_playback_url,
      cloudflare_mp4_download_url: mp4.url,
      r2_object_key: key,
      r2_bucket: r2Env.bucketName,
      r2_video_url: r2VideoUrl,
      playback_mp4: r2VideoUrl,
      archived_at: archivedAt,
      next_archive_retry_at: null,
      updated_at: archivedAt,
    })
    .eq("id", replay.id);

  if (live?.id) {
    await params.supabase
      .from("live_sessions")
      .update({
        recording_status: "ready",
        recording_ready_at: archivedAt,
        storage_provider: "r2",
        playback_provider: "r2",
        archive_status: "posting",
        archive_error: null,
        cloudflare_video_uid: uid,
        cloudflare_playback_url: replay.playback_hls ?? replay.cloudflare_playback_url,
        cloudflare_mp4_download_url: mp4.url,
        r2_object_key: key,
        r2_bucket: r2Env.bucketName,
        r2_video_url: r2VideoUrl,
        archived_at: archivedAt,
        posted_at: archivedAt,
        updated_at: archivedAt,
      })
      .eq("id", live.id);
  }

  let postId = live?.replay_post_id ?? live?.post_id ?? live?.live_post_id ?? null;
  try {
    if (!postId) {
      const { data: insertedPost, error: insertPostError } = await params.supabase
        .from("posts")
        .insert({
          user_id: userId,
          content: live?.title ?? "Live replay",
          video_url: r2VideoUrl,
          post_type: "live",
          metadata: metadataPatch,
        })
        .select("id")
        .single();
      if (insertPostError) throw insertPostError;
      postId = insertedPost.id;
      if (live?.id) {
        await params.supabase.from("live_sessions").update({ post_id: postId, replay_post_id: postId, posted_at: archivedAt }).eq("id", live.id);
      }
    }

    if (postId) {
      const { data: post } = await params.supabase
        .from("posts")
        .select("metadata")
        .eq("id", postId)
        .maybeSingle();

      const metadata = {
        ...((post?.metadata as Record<string, unknown> | null) || {}),
        ...metadataPatch,
      };

      await params.supabase
        .from("posts")
        .update({
          video_url: r2VideoUrl,
          metadata,
          updated_at: archivedAt,
        })
        .eq("id", postId);
    }

    await params.supabase
      .from("creator_library")
      .upsert({
        user_id: userId,
        post_id: postId,
        live_session_id: live?.id ?? replay.live_session_id,
        live_replay_id: replay.id,
        title: live?.title ?? "Live replay",
        media_type: "video",
        storage_provider: "r2",
        playback_provider: "r2",
        r2_object_key: key,
        r2_bucket: r2Env.bucketName,
        video_url: r2VideoUrl,
        thumbnail_url: replay.thumbnail_url ?? null,
        duration_seconds: replay.duration_seconds ?? null,
        filesize_bytes: Number(head.headers.get("content-length") || replay.filesize_bytes || 0) || null,
        source_stream_uid: uid,
        status: "ready",
        updated_at: archivedAt,
      }, { onConflict: "live_replay_id" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markArchiveFailure(params.supabase, replay, `Replay post/library creation failed after R2 upload: ${message}`);
    return { ok: false, status: "failed", replay_id: replay.id, live_session_id: replay.live_session_id, error: message };
  }

  await params.supabase
    .from("live_replays")
    .update({ archive_status: "stream_delete_pending", auto_posted_at: archivedAt, updated_at: archivedAt })
    .eq("id", replay.id);

  if (live?.id) {
    await params.supabase
      .from("live_sessions")
      .update({ status: "archiving", archive_status: "stream_delete_pending", replay_post_id: postId, posted_at: archivedAt, updated_at: archivedAt })
      .eq("id", live.id);
  }

  try {
    await deleteCloudflareStreamUid(uid);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markArchiveFailure(params.supabase, replay, `Cloudflare Stream delete pending: ${message}`);
    return { ok: false, status: "failed", replay_id: replay.id, live_session_id: replay.live_session_id, error: message };
  }
  const streamDeletedAt = nowIso();

  await params.supabase
    .from("live_replays")
    .update({ archive_status: "archived", stream_deleted_at: streamDeletedAt, auto_posted_at: archivedAt, updated_at: streamDeletedAt })
    .eq("id", replay.id);

  if (live?.id) {
    await params.supabase
      .from("live_sessions")
      .update({ status: "posted", archive_status: "archived", stream_deleted_at: streamDeletedAt, auto_posted_at: archivedAt, posted_at: archivedAt, updated_at: streamDeletedAt })
      .eq("id", live.id);
  }

  if (postId) {
    const { data: post } = await params.supabase
      .from("posts")
      .select("metadata")
      .eq("id", postId)
      .maybeSingle();
    const metadata = {
      ...((post?.metadata as Record<string, unknown> | null) || {}),
      stream_deleted_at: streamDeletedAt,
    };
    await params.supabase.from("posts").update({ metadata, updated_at: streamDeletedAt }).eq("id", postId);
  }

  return {
    ok: true,
    status: "archived",
    replay_id: replay.id,
    live_session_id: replay.live_session_id,
    r2_object_key: key,
    r2_video_url: r2VideoUrl,
  };
}

````

## Source: $file

````ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clipboard,
  Eye,
  FileText,
  Home,
  KeyRound,
  Loader2,
  MonitorUp,
  PhoneOff,
  Play,
  Radio,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LiveChatPanel } from '../components/LiveChatPanel';
import { RTMPPlayer } from '../components/RTMPPlayer';
import {
  createRtmpLiveSession,
  endRtmpLiveSession,
  getRtmpLiveSession,
  getRtmpLiveStatus,
  getRtmpStreamKeyForCopy,
  goLiveRtmpSession,
  regenerateRtmpStreamKey,
  saveRtmpLiveDetails,
  type RtmpLiveStatus,
  type RtmpProducerStatus,
} from '../rtmpService';

type LoadState = 'loading' | 'ready' | 'error';

type LivePayload = {
  live_session_id: string;
  stream_key?: string | null;
  rtmp_url?: string | null;
  rtmps_url?: string | null;
  hls_url?: string | null;
  playback_url?: string | null;
  status?: RtmpLiveStatus['status'];
  app_status?: RtmpProducerStatus;
  title?: string | null;
  description?: string | null;
  source_connected_at?: string | null;
  go_live_clicked_at?: string | null;
  live_post_id?: string | null;
  recording_status?: string | null;
  archive_status?: string | null;
  rtmp_started_at?: string | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function CopyButton({ value, label, onCopyValue }: { value?: string | null; label: string; onCopyValue?: () => Promise<string> }) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);

  const copy = async () => {
    try {
      setCopying(true);
      const nextValue = onCopyValue ? await onCopyValue() : value;
      if (!nextValue) return;
      await navigator.clipboard.writeText(nextValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Khong the sao chep.'));
    } finally {
      setCopying(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} disabled={copying || (!value && !onCopyValue)} className="shrink-0">
      {copying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : copied ? <Check className="h-4 w-4 mr-2" /> : <Clipboard className="h-4 w-4 mr-2" />}
      {copying ? 'Dang sao chep' : copied ? 'Da sao chep' : label}
    </Button>
  );
}

function statusLabel(status: RtmpProducerStatus, rtmpStatus: RtmpLiveStatus['status'], archiveStatus?: string | null) {
  if (status === 'live') return 'DANG PHAT TRUC TIEP';
  if (status === 'ready_to_go_live') return 'SAN SANG PHAT';
  if (status === 'source_connected' || rtmpStatus === 'live') return 'DA KET NOI OBS';
  if (status === 'posted' || archiveStatus === 'archived') return 'REPLAY DA DANG';
  if (status === 'ended' || status === 'processing' || status === 'archiving') return 'DANG XU LY REPLAY';
  if (status === 'failed') return 'LOI';
  return 'CHO OBS KET NOI';
}

function StepItem({
  number,
  title,
  description,
  state,
}: {
  number: number;
  title: string;
  description: string;
  state: 'pending' | 'completed' | 'warning';
}) {
  const completed = state === 'completed';
  const warning = state === 'warning';
  return (
    <div className={`rounded-md border p-3 ${completed ? 'border-emerald-500/40 bg-emerald-500/5' : warning ? 'border-amber-500/40 bg-amber-500/5' : 'bg-card'}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${completed ? 'bg-emerald-600 text-white' : warning ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}`}>
          {completed ? <Check className="h-4 w-4" /> : number}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground leading-5">{description}</div>
        </div>
      </div>
    </div>
  );
}

export default function RtmpHostPage() {
  const navigate = useNavigate();
  const { liveSessionId } = useParams<{ liveSessionId: string }>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(liveSessionId || null);
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [rtmpsUrl, setRtmpsUrl] = useState<string | null>(null);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const [rtmpStatus, setRtmpStatus] = useState<RtmpLiveStatus['status']>('waiting');
  const [appStatus, setAppStatus] = useState<RtmpProducerStatus>('waiting_for_obs');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lastSavedTitle, setLastSavedTitle] = useState('');
  const [lastSavedDescription, setLastSavedDescription] = useState('');
  const [sourceConnectedAt, setSourceConnectedAt] = useState<string | null>(null);
  const [livePostId, setLivePostId] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<string | null>(null);
  const [archiveStatus, setArchiveStatus] = useState<string | null>(null);
  const [rtmpStartedAt, setRtmpStartedAt] = useState<string | null>(null);
  const [elapsedLabel, setElapsedLabel] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [goingLive, setGoingLive] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const sourceConnected = appStatus === 'source_connected' || appStatus === 'ready_to_go_live' || appStatus === 'live' || rtmpStatus === 'live';
  const titleValid = title.trim().length > 0;
  const descriptionValid = description.trim().length > 0;
  const detailsValid = titleValid && descriptionValid;
  const detailsDirty = title.trim() !== lastSavedTitle || description.trim() !== lastSavedDescription;
  const isPublicLive = appStatus === 'live';
  const isEnded = ['ended', 'processing', 'archiving', 'posted', 'failed'].includes(appStatus);
  const canGoLive = sourceConnected && detailsValid && !!hlsUrl && !isPublicLive && !isEnded;

  const applyLivePayload = useCallback((live: LivePayload) => {
    setSessionId(live.live_session_id);
    if (live.stream_key) setStreamKey(live.stream_key);
    setRtmpsUrl(live.rtmps_url || live.rtmp_url || null);
    setHlsUrl(live.hls_url || live.playback_url || null);
    setRtmpStatus(live.status || 'waiting');
    setAppStatus(live.app_status || (live.status === 'ended' ? 'ended' : live.status === 'live' ? 'live' : 'waiting_for_obs'));
    if (typeof live.title === 'string') {
      setTitle(live.title);
      setLastSavedTitle(live.title.trim());
    }
    if (typeof live.description === 'string') {
      setDescription(live.description);
      setLastSavedDescription(live.description.trim());
    }
    setSourceConnectedAt(live.source_connected_at || null);
    setLivePostId(live.live_post_id || null);
    setRecordingStatus(live.recording_status || null);
    setArchiveStatus(live.archive_status || null);
    setRtmpStartedAt(live.rtmp_started_at || null);
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!sessionId) return;
    const next = await getRtmpLiveStatus(sessionId);
    setRtmpStatus(next.status);
    setAppStatus(next.app_status || (next.status === 'ended' ? 'ended' : next.status === 'live' ? 'live' : 'waiting_for_obs'));
    if (next.hls_url) setHlsUrl(next.hls_url);
    if (typeof next.title === 'string' && !detailsDirty) setTitle(next.title);
    if (typeof next.description === 'string' && !detailsDirty) setDescription(next.description);
    setSourceConnectedAt(next.source_connected_at || null);
    setLivePostId(next.live_post_id || null);
    setRecordingStatus(next.recording_status || null);
    setArchiveStatus(next.archive_status || null);
    if ((next.app_status === 'posted' || next.app_status === 'ended') && next.archive_status === 'archived') stopPolling();
  }, [detailsDirty, sessionId, stopPolling]);

  useEffect(() => {
    let active = true;

    async function boot() {
      setLoadState('loading');
      setError(null);
      try {
        const live = liveSessionId ? await getRtmpLiveSession(liveSessionId) : await createRtmpLiveSession();
        if (!active) return;
        applyLivePayload(live);
        setLoadState('ready');
        if (live.live_session_id !== liveSessionId) {
          navigate(`/live/${live.live_session_id}/rtmp/host`, { replace: true });
        }
        getRtmpLiveStatus(live.live_session_id).then((next) => {
          if (!active) return;
          applyLivePayload(next as LivePayload);
        }).catch(() => undefined);
      } catch (err: unknown) {
        if (!active) return;
        setLoadState('error');
        setError(getErrorMessage(err, 'Khong the tao OBS live session.'));
      }
    }

    boot();
    return () => {
      active = false;
      stopPolling();
    };
  }, [applyLivePayload, liveSessionId, navigate, stopPolling]);

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`obs-live-producer-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as {
            status?: RtmpProducerStatus;
            rtmp_status?: RtmpLiveStatus['status'];
            hls_url?: string | null;
            playback_url?: string | null;
            title?: string | null;
            description?: string | null;
            source_connected_at?: string | null;
            live_post_id?: string | null;
            post_id?: string | null;
            recording_status?: string | null;
            archive_status?: string | null;
            rtmp_started_at?: string | null;
          };
          setAppStatus(row.status || 'waiting_for_obs');
          setRtmpStatus(row.rtmp_status || 'waiting');
          if (row.hls_url || row.playback_url) setHlsUrl(row.hls_url || row.playback_url || null);
          if (typeof row.title === 'string' && !detailsDirty) setTitle(row.title);
          if (typeof row.description === 'string' && !detailsDirty) setDescription(row.description);
          setSourceConnectedAt(row.source_connected_at || null);
          setLivePostId(row.live_post_id || row.post_id || null);
          setRecordingStatus(row.recording_status || null);
          setArchiveStatus(row.archive_status || null);
          if (row.rtmp_started_at) setRtmpStartedAt(row.rtmp_started_at);
        },
      )
      .subscribe();

    stopPolling();
    pollTimerRef.current = setInterval(() => {
      refreshStatus().catch(() => undefined);
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      stopPolling();
    };
  }, [detailsDirty, refreshStatus, sessionId, stopPolling]);

  useEffect(() => {
    if (!sourceConnected || !rtmpStartedAt) {
      setElapsedLabel('');
      return;
    }
    const compute = () => {
      const startedMs = Date.parse(rtmpStartedAt);
      if (!Number.isFinite(startedMs)) return '';
      const diff = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      const pad = (n: number) => n.toString().padStart(2, '0');
      return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    };
    setElapsedLabel(compute());
    const id = setInterval(() => setElapsedLabel(compute()), 1000);
    return () => clearInterval(id);
  }, [rtmpStartedAt, sourceConnected]);

  const validationText = useMemo(() => {
    if (!sourceConnected) return 'OBS chua ket noi toi Cloudflare.';
    if (!titleValid) return 'Vui long nhap tieu de.';
    if (!descriptionValid) return 'Vui long nhap mo ta.';
    if (!hlsUrl) return 'Dang cho Cloudflare tao playback URL.';
    return '';
  }, [descriptionValid, hlsUrl, sourceConnected, titleValid]);

  const saveDetails = async () => {
    if (!sessionId) return null;
    if (!titleValid) {
      toast.error('Tieu de la bat buoc.');
      return null;
    }
    if (!descriptionValid) {
      toast.error('Mo ta la bat buoc.');
      return null;
    }
    setSavingDetails(true);
    try {
      const updated = await saveRtmpLiveDetails(sessionId, {
        title: title.trim(),
        description: description.trim(),
      });
      applyLivePayload(updated);
      toast.success('Da luu chi tiet bai viet.');
      return updated;
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Khong the luu chi tiet bai viet.'));
      return null;
    } finally {
      setSavingDetails(false);
    }
  };

  const goLive = async () => {
    if (!sessionId) return;
    if (!canGoLive) {
      toast.error(validationText || 'Chua du dieu kien phat truc tiep.');
      return;
    }
    setGoingLive(true);
    try {
      if (detailsDirty) {
        const saved = await saveDetails();
        if (!saved) return;
      }
      const live = await goLiveRtmpSession(sessionId);
      applyLivePayload(live);
      toast.success('Da phat truc tiep. Bai LIVE da xuat hien tren feed.');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Khong the phat truc tiep.'));
    } finally {
      setGoingLive(false);
    }
  };

  const resetKey = async () => {
    if (!sessionId) return;
    try {
      const next = await regenerateRtmpStreamKey(sessionId);
      applyLivePayload(next);
      toast.success('Da tao Stream Key moi.');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Khong the dat lai Stream Key.'));
    }
  };

  const endLive = async () => {
    if (!sessionId) return;
    try {
      await endRtmpLiveSession(sessionId);
      setAppStatus('ended');
      setRtmpStatus('ended');
      toast.success('Da ket thuc livestream. Replay se duoc xu ly va luu sang R2.');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Khong the ket thuc livestream.'));
    }
  };

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Dang chuan bi Live Producer...</span>
        </div>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="min-h-screen bg-background">
        <FacebookNavbar />
        <div className="pt-20 px-4 max-w-xl mx-auto">
          <Card className="p-6 space-y-4">
            <div className="font-semibold text-lg">Khong the mo Live Producer</div>
            <div className="text-sm text-muted-foreground">{error}</div>
            <Button variant="outline" onClick={() => navigate('/')}>
              <Home className="h-4 w-4 mr-2" />
              Ve trang chu
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const label = statusLabel(appStatus, rtmpStatus, archiveStatus);

  return (
    <div className="min-h-screen bg-background">
      <FacebookNavbar />
      <main className="pt-16 pb-4">
        <div className="border-b bg-card/70 px-3 md:px-6 py-3">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-bold truncate">Live Producer</h1>
                <p className="text-xs text-muted-foreground truncate">Phan mem phat truc tiep / RTMP / OBS</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isPublicLive ? 'destructive' : sourceConnected ? 'default' : 'outline'} className="gap-1">
                <Radio className={`h-3.5 w-3.5 ${isPublicLive ? 'animate-pulse' : ''}`} />
                {label}
              </Badge>
              {sourceConnected && elapsedLabel && (
                <span className="hidden sm:inline text-xs font-mono text-muted-foreground">{elapsedLabel}</span>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_390px] gap-4 px-3 md:px-6 pt-4">
          <aside className="space-y-3">
            <Card className="p-3 space-y-3">
              <div className="text-sm font-semibold">Tien trinh</div>
              <StepItem
                number={1}
                title="Ket noi nguon video"
                description={sourceConnected ? 'Cloudflare da nhan tin hieu tu OBS.' : 'Sao chep RTMPS URL va Stream Key vao OBS.'}
                state={sourceConnected ? 'completed' : 'pending'}
              />
              <StepItem
                number={2}
                title="Hoan tat chi tiet bai viet"
                description={detailsValid ? 'Tieu de va mo ta da san sang.' : 'Tieu de va mo ta la bat buoc.'}
                state={detailsValid ? 'completed' : 'warning'}
              />
              <StepItem
                number={3}
                title="Phat truc tiep"
                description={isPublicLive ? 'Live post dang hien tren feed.' : canGoLive ? 'Da du dieu kien de phat truc tiep.' : 'Chi mo khi OBS, chi tiet va playback da san sang.'}
                state={isPublicLive || canGoLive ? 'completed' : 'pending'}
              />
            </Card>

            <Card className="p-3 space-y-2 text-xs text-muted-foreground leading-5">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Luu y
              </div>
              <p>OBS co the dang gui tin hieu nhung viewer se chua thay live cho den khi bam Phat truc tiep.</p>
              <p>Control panel nay co the dong/refresh. OBS moi la nguon video chinh.</p>
            </Card>
          </aside>

          <section className="space-y-4">
            <Card className="overflow-hidden">
              <div className="aspect-video bg-black">
                <RTMPPlayer
                  src={sourceConnected ? hlsUrl : null}
                  waitingLabel={
                    sourceConnected
                      ? 'Dang tai preview tu Cloudflare...'
                      : 'Ket noi phan mem phat truc tiep de xem preview.'
                  }
                />
              </div>
            </Card>

            <Card className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Nguon video</div>
                  <div className="font-medium flex items-center gap-1.5">
                    {sourceConnected ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <MonitorUp className="h-4 w-4" />}
                    {sourceConnected ? 'Da ket noi' : 'Dang cho'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Trang thai public</div>
                  <div className="font-medium">{isPublicLive ? 'Dang live' : isEnded ? 'Da ket thuc' : 'Chua public'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Recording</div>
                  <div className="font-medium">{recordingStatus || 'idle'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Archive</div>
                  <div className="font-medium">{archiveStatus || 'pending'}</div>
                </div>
              </div>
            </Card>

            {isPublicLive && sessionId && (
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">Live post da xuat hien tren feed</div>
                    <div className="text-sm text-muted-foreground">Viewer co the xem live tren feed/profile hoac trang live.</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate(`/live/${sessionId}`)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Xem nhu viewer
                    </Button>
                    <Button variant="destructive" onClick={endLive}>
                      <PhoneOff className="h-4 w-4 mr-2" />
                      Ket thuc live
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </section>

          <aside className="space-y-4">
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Nguon video
                </div>
                <Badge variant="outline">RTMP/OBS</Badge>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="text-sm font-medium">URL may chu / RTMPS URL</div>
                  <div className="flex gap-2">
                    <code className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 text-xs break-all">{rtmpsUrl || 'Dang tao RTMPS URL...'}</code>
                    <CopyButton value={rtmpsUrl} label="URL" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-sm font-medium">Stream Key</div>
                  <div className="flex gap-2">
                    <code className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 text-xs break-all">{streamKey || '****************'}</code>
                    {sessionId && <CopyButton label="Key" onCopyValue={() => getRtmpStreamKeyForCopy(sessionId)} />}
                  </div>
                </div>
              </div>

              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground leading-5">
                <div>OBS {'->'} Settings {'->'} Stream</div>
                <div>Service = Custom</div>
                <div>Server = RTMPS URL</div>
                <div>Stream Key = Stream Key</div>
                <div>Start Streaming trong OBS, sau do quay lai day de Phat truc tiep.</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => refreshStatus().catch((err) => toast.error(getErrorMessage(err, 'Khong the refresh.')))}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Lam moi
                </Button>
                <Button variant="outline" size="sm" onClick={resetKey} disabled={!sessionId || sourceConnected || isPublicLive || isEnded}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Dat lai Stream Key
                </Button>
              </div>

              {sourceConnectedAt && (
                <div className="text-xs text-emerald-700 dark:text-emerald-400">
                  OBS da ket noi luc {new Date(sourceConnectedAt).toLocaleString()}.
                </div>
              )}
            </Card>

            <Card className="p-4 space-y-4">
              <div className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Chi tiet bai viet
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="live-title">Tieu de</label>
                <Input
                  id="live-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onBlur={() => {
                    if (detailsValid && detailsDirty) saveDetails().catch(() => undefined);
                  }}
                  placeholder="Nhap tieu de livestream"
                  disabled={isPublicLive || isEnded}
                />
                {!titleValid && <div className="text-xs text-destructive">Tieu de la bat buoc.</div>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="live-description">Mo ta</label>
                <Textarea
                  id="live-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  onBlur={() => {
                    if (detailsValid && detailsDirty) saveDetails().catch(() => undefined);
                  }}
                  placeholder="Mo ta noi dung buoi live"
                  className="min-h-[110px]"
                  disabled={isPublicLive || isEnded}
                />
                {!descriptionValid && <div className="text-xs text-destructive">Mo ta la bat buoc.</div>}
              </div>

              <Button variant="outline" onClick={saveDetails} disabled={!detailsValid || savingDetails || isPublicLive || isEnded || !detailsDirty}>
                {savingDetails ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Luu chi tiet
              </Button>
            </Card>

            <Card className="p-4 space-y-3">
              <Button className="w-full" size="lg" onClick={goLive} disabled={!canGoLive || goingLive}>
                {goingLive ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Phat truc tiep
              </Button>
              {!canGoLive && !isPublicLive && (
                <div className="text-xs text-muted-foreground leading-5">{validationText}</div>
              )}
              {isPublicLive && livePostId && (
                <div className="text-xs text-emerald-700 dark:text-emerald-400">Live post ID: {livePostId}</div>
              )}
              {isEnded && sessionId && (
                <Button variant="outline" className="w-full" onClick={() => navigate(`/live/${sessionId}`)}>
                  Xem replay/status
                </Button>
              )}
            </Card>

            {sessionId && isPublicLive && <LiveChatPanel sessionId={sessionId} className="h-[360px]" />}
          </aside>
        </div>
      </main>
    </div>
  );
}

````

## Source: $file

````ts
import { supabase } from '@/integrations/supabase/client';
import type { RtmpStatus } from './types';

export type RtmpProducerStatus =
  | 'waiting_for_obs'
  | 'source_connected'
  | 'ready_to_go_live'
  | 'live'
  | 'ended'
  | 'processing'
  | 'archiving'
  | 'posted'
  | 'failed';

type RtmpLiveResponse = {
  live_session_id: string;
  stream_key: string | null;
  rtmp_url: string | null;
  rtmps_url?: string | null;
  hls_url: string;
  status: RtmpStatus;
  app_status?: RtmpProducerStatus;
  live_mode?: 'rtmp' | 'rtmp_obs';
  mode?: 'rtmp_obs';
  stream_provider?: 'nginx_rtmp' | 'cloudflare_stream';
  cloudflare_live_input_id?: string | null;
  title?: string | null;
  description?: string | null;
  source_connected_at?: string | null;
  go_live_clicked_at?: string | null;
  live_post_id?: string | null;
  replay_post_id?: string | null;
  rtmp_started_at?: string | null;
  started_at?: string | null;
  recording_status?: string | null;
  archive_status?: string | null;
};

export type RtmpLiveStatus = {
  live_session_id: string;
  stream_key?: string | null;
  status: RtmpStatus;
  hls_url: string | null;
  app_status: RtmpProducerStatus;
  title?: string | null;
  description?: string | null;
  source_connected_at?: string | null;
  go_live_clicked_at?: string | null;
  live_post_id?: string | null;
  rtmp_started_at?: string | null;
  started_at?: string | null;
  recording_status?: string | null;
  archive_status?: string | null;
};

type RtmpStreamCredentials = {
  stream_key_with_password: string;
};

async function invokeRtmp<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('live-rtmp', { body });
  if (error) throw error;
  const payload = data as { error?: string } & T;
  if (payload?.error) throw new Error(payload.error);
  return payload as T;
}

export async function createRtmpLiveSession(input: {
  title?: string;
  description?: string;
  privacy?: 'public' | 'friends';
} = {}): Promise<RtmpLiveResponse> {
  return invokeRtmp<RtmpLiveResponse>({
    action: 'create',
    title: input.title,
    description: input.description,
    privacy: input.privacy || 'public',
  });
}

export async function getRtmpLiveStatus(sessionId: string): Promise<RtmpLiveStatus> {
  return invokeRtmp<RtmpLiveStatus>({
    action: 'status',
    live_session_id: sessionId,
  });
}

export async function getRtmpLiveSession(sessionId: string): Promise<RtmpLiveResponse> {
  return invokeRtmp<RtmpLiveResponse>({
    action: 'host-session',
    live_session_id: sessionId,
  });
}

export async function endRtmpLiveSession(sessionId: string): Promise<void> {
  await invokeRtmp<{ ok: true }>({
    action: 'end',
    live_session_id: sessionId,
  });
}

export async function saveRtmpLiveDetails(sessionId: string, input: {
  title: string;
  description: string;
}): Promise<RtmpLiveResponse> {
  return invokeRtmp<RtmpLiveResponse>({
    action: 'save-details',
    live_session_id: sessionId,
    title: input.title,
    description: input.description,
  });
}

export async function goLiveRtmpSession(sessionId: string): Promise<RtmpLiveResponse> {
  return invokeRtmp<RtmpLiveResponse>({
    action: 'go-live',
    live_session_id: sessionId,
  });
}

export async function startRtmpLiveSession(sessionId: string): Promise<RtmpLiveResponse> {
  return invokeRtmp<RtmpLiveResponse>({
    action: 'start',
    live_session_id: sessionId,
  });
}

export async function getRtmpStreamKeyForCopy(sessionId: string): Promise<string> {
  const credentials = await invokeRtmp<RtmpStreamCredentials>({
    action: 'copy-stream-key',
    live_session_id: sessionId,
  });
  return credentials.stream_key_with_password;
}

export async function regenerateRtmpStreamKey(sessionId: string): Promise<RtmpLiveResponse> {
  return invokeRtmp<RtmpLiveResponse>({
    action: 'reset-stream-key',
    live_session_id: sessionId,
  });
}

````

## Source: $file

````ts
export type LivePrivacy = 'public' | 'friends';
export type LiveStatus =
  | 'created'
  | 'waiting_for_obs'
  | 'source_connected'
  | 'ready_to_go_live'
  | 'live'
  | 'ended'
  | 'processing'
  | 'archiving'
  | 'posted'
  | 'failed';
export type LiveSource = 'agora' | 'rtmp';
export type LiveMode = 'webcam' | 'rtmp' | 'rtmp_obs';
export type StreamProvider = 'agora' | 'nginx_rtmp' | 'cloudflare_stream';
export type RtmpStatus = 'idle' | 'waiting' | 'live' | 'ended';

export interface LiveHostProfile {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface LiveSession {
  id: string;
  host_user_id: string;
  agora_channel?: string | null;
  channel_name: string;
  source?: LiveSource;
  mode?: 'agora' | 'agora_webcam' | 'rtmp_obs' | null;
  live_mode?: LiveMode;
  stream_provider?: StreamProvider;
  stream_key?: string | null;
  rtmps_url?: string | null;
  playback_url?: string | null;
  cloudflare_live_input_id?: string | null;
  cloudflare_video_uid?: string | null;
  rtmp_status?: RtmpStatus | null;
  rtmp_started_at?: string | null;
  rtmp_ended_at?: string | null;
  hls_url?: string | null;
  hls_playback_url?: string | null;
  agora_uid_host?: number | null;
  recording_uid?: number | null;
  recording_status?:
    | 'idle'
    | 'acquired'
    | 'acquiring'
    | 'starting'
    | 'recording'
    | 'stopping'
    | 'uploading'
    | 'queued'
    | 'processing'
    | 'ready'
    | 'stopped'
    | 'failed'
    | 'deleted'
    | null;
  archive_status?: 'pending' | 'ready' | 'mp4_pending' | 'archiving' | 'archived' | 'posting' | 'posted' | 'stream_delete_pending' | 'failed' | null;
  storage_provider?: 'cloudflare_stream' | 'r2' | null;
  playback_provider?: 'cloudflare_stream' | 'r2' | null;
  r2_video_url?: string | null;
  title: string | null;
  description?: string | null;
  privacy: LivePrivacy;
  status: LiveStatus;
  viewer_count: number;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  post_id: string | null;
  host_profile?: LiveHostProfile | null;
}

export interface CreateLiveSessionInput {
  title?: string;
  privacy: LivePrivacy;
}

````

## Source: $file

````ts
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, Eye, Loader2, Radio, Volume2, VolumeX } from 'lucide-react';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLiveSession } from '../useLiveSession';
import { useLiveRtc } from '../hooks/useLiveRtc';
import { useLiveReplay } from '../hooks/useLiveReplay';
import { incrementLiveViewerCount, decrementLiveViewerCount } from '../liveService';
import { LiveChatPanel } from '../components/LiveChatPanel';
import { FloatingReactions } from '../components/FloatingReactions';
import { RTMPPlayer } from '../components/RTMPPlayer';

export default function LiveAudiencePage() {
  const navigate = useNavigate();
  const { liveSessionId } = useParams<{ liveSessionId: string }>();
  const { data: session, isLoading } = useLiveSession(liveSessionId);
  const [mobileTab, setMobileTab] = useState<'chat' | 'reactions'>('chat');
  const isRtmp = session?.stream_provider === 'nginx_rtmp' || session?.stream_provider === 'cloudflare_stream' || session?.live_mode === 'rtmp' || session?.live_mode === 'rtmp_obs' || session?.source === 'rtmp';
  const rtmpHlsUrl = session?.hls_url || session?.hls_playback_url || session?.playback_url || (session?.stream_key ? `https://live.camly.co/hls/${session.stream_key}.m3u8` : null);
  const isEnded = !!session && !['live', 'waiting_for_obs', 'source_connected', 'ready_to_go_live'].includes(session.status);
  const { data: replay } = useLiveReplay(liveSessionId, isEnded);
  const replayUrl = replay?.status === 'ready'
    ? (replay.r2_video_url || replay.playback_mp4 || replay.playback_hls)
    : null;
  const replayIsMp4 = !!replayUrl && /\.(mp4)(\?|$)/i.test(replayUrl);
  const isWatchingReplay = isEnded && !!replayUrl;
  const replayProcessing = isEnded && ['uploading', 'queued', 'processing', 'recording'].includes(String(replay?.status || session?.recording_status || ''));

  const {
    remoteContainerRef,
    statusText,
    hasRemoteVideo,
    isMuted,
    start,
    leave,
    toggleRemoteAudio,
  } = useLiveRtc({
    sessionId: liveSessionId,
    role: 'audience',
    enabled: !!liveSessionId && session?.status === 'live' && !isRtmp,
  });

  useEffect(() => {
    if (isRtmp) return;
    if (!liveSessionId || !session || session.status !== 'live') return;
    start().catch(() => undefined);
  }, [isRtmp, liveSessionId, session, start]);

  // Track viewer count via database
  useEffect(() => {
    if (!liveSessionId || session?.status !== 'live') return;

    incrementLiveViewerCount(liveSessionId).catch(console.warn);

    const handleBeforeUnload = () => {
      decrementLiveViewerCount(liveSessionId).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      decrementLiveViewerCount(liveSessionId).catch(() => {});
    };
  }, [liveSessionId, session?.status]);

  useEffect(() => {
    if (isEnded) {
      leave().catch(() => undefined);
    }
  }, [isEnded, leave]);

  useEffect(() => {
    return () => {
      leave().catch(() => undefined);
    };
  }, [leave]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6">Live session not found.</Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <FacebookNavbar />
      <main className="pt-16 px-3 md:px-6 pb-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={session.host_profile?.avatar_url || ''} />
                  <AvatarFallback>
                    {session.host_profile?.username?.charAt(0)?.toUpperCase() || 'H'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-sm">{session.host_profile?.full_name || session.host_profile?.username || 'Host'}</div>
                  <h1 className="text-lg md:text-xl font-bold">{session.title || 'Live Stream'}</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={session.status === 'live' ? 'destructive' : 'secondary'} className="gap-1">
                  <Radio className="h-3.5 w-3.5" />
                  {session.status === 'live' ? 'LIVE' : isWatchingReplay ? 'REPLAY' : 'ENDED'}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {session.viewer_count || 0}
                </Badge>
                {isEnded && replay?.playback_mp4 && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                  >
                    <a
                      href={replay.playback_mp4}
                      download={`live-${liveSessionId}.mp4`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4" />
                      Táº£i MP4
                    </a>
                  </Button>
                )}
                {isEnded && !replay?.playback_mp4 && isWatchingReplay && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="gap-1.5"
                    title="Cloudflare Ä‘ang táº¡o file MP4, vui lĂ²ng quay láº¡i sau vĂ i phĂºt"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Äang táº¡o MP4...
                  </Button>
                )}
              </div>
            </div>

            <Card className="overflow-hidden">
              <div className="aspect-video bg-black relative">
                {isEnded ? (
                  replayUrl ? (
                    replayIsMp4 ? (
                      <video
                        src={replayUrl}
                        className="h-full w-full object-contain bg-black"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <RTMPPlayer src={replayUrl} waitingLabel="" />
                    )
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 bg-black/70 gap-2 text-center px-4">
                      {replay?.status === 'failed' || session.recording_status === 'failed' ? (
                        <span>KhĂ´ng thá»ƒ xá»­ lĂ½ video. Live Ä‘Ă£ káº¿t thĂºc.</span>
                      ) : replayProcessing ? (
                        <>
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span>Video Ä‘ang Ä‘Æ°á»£c xá»­ lĂ½, vui lĂ²ng quay láº¡i sau Ă­t phĂºt...</span>
                        </>
                      ) : (
                        <span>This live has ended.</span>
                      )}
                    </div>
                  )
                ) : isRtmp ? (
                  <RTMPPlayer
                    src={session.rtmp_status === 'live' || session.status === 'live' ? rtmpHlsUrl : null}
                    waitingLabel={session.status === 'waiting_for_obs' ? 'Dang cho OBS ket noi...' : 'Waiting for RTMP stream...'}
                  />
                ) : (
                  <>
                    <div ref={remoteContainerRef} className="h-full w-full" />
                    {!hasRemoteVideo && (
                      <div className="absolute inset-0 flex items-center justify-center text-white/90 bg-black/50 text-center px-4">
                        {statusText}
                      </div>
                    )}
                  </>
                )}

                {!isRtmp && !isEnded && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute bottom-3 left-3 z-10 bg-black/30 hover:bg-black/50 text-white rounded-full h-10 w-10"
                    onClick={toggleRemoteAudio}
                  >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>
                )}

                {liveSessionId && <FloatingReactions sessionId={liveSessionId} />}
              </div>
            </Card>

            <div className="lg:hidden border rounded-xl bg-card overflow-hidden">
              <div className="grid grid-cols-2 border-b">
                <button
                  className={`py-2 text-sm font-medium ${mobileTab === 'chat' ? 'bg-accent' : ''}`}
                  onClick={() => setMobileTab('chat')}
                >
                  Chat
                </button>
                <button
                  className={`py-2 text-sm font-medium ${mobileTab === 'reactions' ? 'bg-accent' : ''}`}
                  onClick={() => setMobileTab('reactions')}
                >
                  Reactions
                </button>
              </div>
              <div className="p-2">
                {mobileTab === 'chat' && liveSessionId && <LiveChatPanel sessionId={liveSessionId} className="h-[320px]" />}
                {mobileTab === 'reactions' && liveSessionId && (
                  <div className="h-[120px] flex items-center justify-center relative">
                    <FloatingReactions sessionId={liveSessionId} showPicker />
                  </div>
                )}
              </div>
            </div>
          </section>

          {liveSessionId && <LiveChatPanel sessionId={liveSessionId} className="hidden lg:flex h-[calc(100vh-120px)]" />}
        </div>
        <div className="max-w-7xl mx-auto mt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            Back
          </Button>
        </div>
      </main>
    </div>
  );
}

````


# Full Git Patch

````diffdiff --git a/src/modules/live/pages/LiveAudiencePage.tsx b/src/modules/live/pages/LiveAudiencePage.tsx index cc26ae6..44c65b8 100644 --- a/src/modules/live/pages/LiveAudiencePage.tsx +++ b/src/modules/live/pages/LiveAudiencePage.tsx @@ -21,7 +21,7 @@ export default function LiveAudiencePage() {    const [mobileTab, setMobileTab] = useState<'chat' | 'reactions'>('chat');    const isRtmp = session?.stream_provider === 'nginx_rtmp' || session?.stream_provider === 'cloudflare_stream' || session?.live_mode === 'rtmp' || session?.live_mode === 'rtmp_obs' || session?.source === 'rtmp';    const rtmpHlsUrl = session?.hls_url || session?.hls_playback_url || session?.playback_url || (session?.stream_key ? `https://live.camly.co/hls/${session.stream_key}.m3u8` : null); -  const isEnded = !!session && session.status !== 'live' && session.status !== 'waiting_for_obs'; +  const isEnded = !!session && !['live', 'waiting_for_obs', 'source_connected', 'ready_to_go_live'].includes(session.status);    const { data: replay } = useLiveReplay(liveSessionId, isEnded);    const replayUrl = replay?.status === 'ready'      ? (replay.r2_video_url || replay.playback_mp4 || replay.playback_hls) diff --git a/src/modules/live/pages/RtmpHostPage.tsx b/src/modules/live/pages/RtmpHostPage.tsx index 457cba1..3b999ec 100644 --- a/src/modules/live/pages/RtmpHostPage.tsx +++ b/src/modules/live/pages/RtmpHostPage.tsx @@ -1,12 +1,31 @@ -import { useCallback, useEffect, useRef, useState } from 'react'; +import { useCallback, useEffect, useMemo, useRef, useState } from 'react';  import { useNavigate, useParams } from 'react-router-dom'; -import { Check, Clipboard, Home, KeyRound, Loader2, PhoneOff, Radio, RefreshCw } from 'lucide-react'; +import { +  AlertTriangle, +  ArrowLeft, +  Check, +  CheckCircle2, +  Clipboard, +  Eye, +  FileText, +  Home, +  KeyRound, +  Loader2, +  MonitorUp, +  PhoneOff, +  Play, +  Radio, +  RefreshCw, +  Settings2, +} from 'lucide-react';  import { toast } from 'sonner';  import { supabase } from '@/integrations/supabase/client';  import { FacebookNavbar } from '@/components/layout/FacebookNavbar';  import { Badge } from '@/components/ui/badge';  import { Button } from '@/components/ui/button';  import { Card } from '@/components/ui/card'; +import { Input } from '@/components/ui/input'; +import { Textarea } from '@/components/ui/textarea';  import { LiveChatPanel } from '../components/LiveChatPanel';  import { RTMPPlayer } from '../components/RTMPPlayer';  import { @@ -15,12 +34,33 @@ import {    getRtmpLiveSession,    getRtmpLiveStatus,    getRtmpStreamKeyForCopy, +  goLiveRtmpSession,    regenerateRtmpStreamKey, +  saveRtmpLiveDetails,    type RtmpLiveStatus, +  type RtmpProducerStatus,  } from '../rtmpService';    type LoadState = 'loading' | 'ready' | 'error'; -type AppStatus = 'waiting_for_obs' | 'live' | 'ended' | 'processing' | 'archiving' | 'posted' | 'failed'; + +type LivePayload = { +  live_session_id: string; +  stream_key?: string | null; +  rtmp_url?: string | null; +  rtmps_url?: string | null; +  hls_url?: string | null; +  playback_url?: string | null; +  status?: RtmpLiveStatus['status']; +  app_status?: RtmpProducerStatus; +  title?: string | null; +  description?: string | null; +  source_connected_at?: string | null; +  go_live_clicked_at?: string | null; +  live_post_id?: string | null; +  recording_status?: string | null; +  archive_status?: string | null; +  rtmp_started_at?: string | null; +};    function getErrorMessage(error: unknown, fallback: string) {    return error instanceof Error ? error.message : fallback; @@ -39,7 +79,7 @@ function CopyButton({ value, label, onCopyValue }: { value?: string | null; labe        setCopied(true);        window.setTimeout(() => setCopied(false), 1400);      } catch (err: unknown) { -      toast.error(getErrorMessage(err, 'Khong the copy.')); +      toast.error(getErrorMessage(err, 'Khong the sao chep.'));      } finally {        setCopying(false);      } @@ -48,17 +88,47 @@ function CopyButton({ value, label, onCopyValue }: { value?: string | null; labe    return (      <Button type="button" variant="outline" size="sm" onClick={copy} disabled={copying || (!value && !onCopyValue)} className="shrink-0">        {copying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : copied ? <Check className="h-4 w-4 mr-2" /> : <Clipboard className="h-4 w-4 mr-2" />} -      {copying ? 'Copying...' : copied ? 'Copied' : label} +      {copying ? 'Dang sao chep' : copied ? 'Da sao chep' : label}      </Button>    );  }   -function statusLabel(status: AppStatus, rtmpStatus: RtmpLiveStatus['status'], archiveStatus?: string | null) { -  if (status === 'live' || rtmpStatus === 'live') return 'LIVE'; -  if (status === 'posted' || archiveStatus === 'archived') return 'REPLAY POSTED'; -  if (status === 'ended' || status === 'processing' || status === 'archiving') return 'PROCESSING REPLAY'; -  if (status === 'failed') return 'FAILED'; -  return 'WAITING FOR OBS'; +function statusLabel(status: RtmpProducerStatus, rtmpStatus: RtmpLiveStatus['status'], archiveStatus?: string | null) { +  if (status === 'live') return 'DANG PHAT TRUC TIEP'; +  if (status === 'ready_to_go_live') return 'SAN SANG PHAT'; +  if (status === 'source_connected' || rtmpStatus === 'live') return 'DA KET NOI OBS'; +  if (status === 'posted' || archiveStatus === 'archived') return 'REPLAY DA DANG'; +  if (status === 'ended' || status === 'processing' || status === 'archiving') return 'DANG XU LY REPLAY'; +  if (status === 'failed') return 'LOI'; +  return 'CHO OBS KET NOI'; +} + +function StepItem({ +  number, +  title, +  description, +  state, +}: { +  number: number; +  title: string; +  description: string; +  state: 'pending' | 'completed' | 'warning'; +}) { +  const completed = state === 'completed'; +  const warning = state === 'warning'; +  return ( +    <div className={`rounded-md border p-3 ${completed ? 'border-emerald-500/40 bg-emerald-500/5' : warning ? 'border-amber-500/40 bg-amber-500/5' : 'bg-card'}`}> +      <div className="flex items-start gap-3"> +        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${completed ? 'bg-emerald-600 text-white' : warning ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}`}> +          {completed ? <Check className="h-4 w-4" /> : number} +        </div> +        <div className="min-w-0"> +          <div className="text-sm font-semibold">{title}</div> +          <div className="text-xs text-muted-foreground leading-5">{description}</div> +        </div> +      </div> +    </div> +  );  }    export default function RtmpHostPage() { @@ -71,11 +141,19 @@ export default function RtmpHostPage() {    const [rtmpsUrl, setRtmpsUrl] = useState<string | null>(null);    const [hlsUrl, setHlsUrl] = useState<string | null>(null);    const [rtmpStatus, setRtmpStatus] = useState<RtmpLiveStatus['status']>('waiting'); -  const [appStatus, setAppStatus] = useState<AppStatus>('waiting_for_obs'); +  const [appStatus, setAppStatus] = useState<RtmpProducerStatus>('waiting_for_obs'); +  const [title, setTitle] = useState(''); +  const [description, setDescription] = useState(''); +  const [lastSavedTitle, setLastSavedTitle] = useState(''); +  const [lastSavedDescription, setLastSavedDescription] = useState(''); +  const [sourceConnectedAt, setSourceConnectedAt] = useState<string | null>(null); +  const [livePostId, setLivePostId] = useState<string | null>(null);    const [recordingStatus, setRecordingStatus] = useState<string | null>(null);    const [archiveStatus, setArchiveStatus] = useState<string | null>(null);    const [rtmpStartedAt, setRtmpStartedAt] = useState<string | null>(null); -  const [elapsedLabel, setElapsedLabel] = useState<string>(''); +  const [elapsedLabel, setElapsedLabel] = useState(''); +  const [savingDetails, setSavingDetails] = useState(false); +  const [goingLive, setGoingLive] = useState(false);    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);      const stopPolling = useCallback(() => { @@ -85,26 +163,35 @@ export default function RtmpHostPage() {      }    }, []);   -  const applyLivePayload = useCallback((live: { -    live_session_id: string; -    stream_key?: string | null; -    rtmp_url?: string | null; -    rtmps_url?: string | null; -    hls_url?: string | null; -    playback_url?: string | null; -    status?: RtmpLiveStatus['status']; -    app_status?: AppStatus; -    recording_status?: string | null; -    archive_status?: string | null; -  }) => { +  const sourceConnected = appStatus === 'source_connected' || appStatus === 'ready_to_go_live' || appStatus === 'live' || rtmpStatus === 'live'; +  const titleValid = title.trim().length > 0; +  const descriptionValid = description.trim().length > 0; +  const detailsValid = titleValid && descriptionValid; +  const detailsDirty = title.trim() !== lastSavedTitle || description.trim() !== lastSavedDescription; +  const isPublicLive = appStatus === 'live'; +  const isEnded = ['ended', 'processing', 'archiving', 'posted', 'failed'].includes(appStatus); +  const canGoLive = sourceConnected && detailsValid && !!hlsUrl && !isPublicLive && !isEnded; + +  const applyLivePayload = useCallback((live: LivePayload) => {      setSessionId(live.live_session_id);      if (live.stream_key) setStreamKey(live.stream_key);      setRtmpsUrl(live.rtmps_url || live.rtmp_url || null);      setHlsUrl(live.hls_url || live.playback_url || null);      setRtmpStatus(live.status || 'waiting');      setAppStatus(live.app_status || (live.status === 'ended' ? 'ended' : live.status === 'live' ? 'live' : 'waiting_for_obs')); +    if (typeof live.title === 'string') { +      setTitle(live.title); +      setLastSavedTitle(live.title.trim()); +    } +    if (typeof live.description === 'string') { +      setDescription(live.description); +      setLastSavedDescription(live.description.trim()); +    } +    setSourceConnectedAt(live.source_connected_at || null); +    setLivePostId(live.live_post_id || null);      setRecordingStatus(live.recording_status || null);      setArchiveStatus(live.archive_status || null); +    setRtmpStartedAt(live.rtmp_started_at || null);    }, []);      const refreshStatus = useCallback(async () => { @@ -113,10 +200,14 @@ export default function RtmpHostPage() {      setRtmpStatus(next.status);      setAppStatus(next.app_status || (next.status === 'ended' ? 'ended' : next.status === 'live' ? 'live' : 'waiting_for_obs'));      if (next.hls_url) setHlsUrl(next.hls_url); +    if (typeof next.title === 'string' && !detailsDirty) setTitle(next.title); +    if (typeof next.description === 'string' && !detailsDirty) setDescription(next.description); +    setSourceConnectedAt(next.source_connected_at || null); +    setLivePostId(next.live_post_id || null);      setRecordingStatus(next.recording_status || null);      setArchiveStatus(next.archive_status || null);      if ((next.app_status === 'posted' || next.app_status === 'ended') && next.archive_status === 'archived') stopPolling(); -  }, [sessionId, stopPolling]); +  }, [detailsDirty, sessionId, stopPolling]);      useEffect(() => {      let active = true; @@ -132,14 +223,9 @@ export default function RtmpHostPage() {          if (live.live_session_id !== liveSessionId) {            navigate(`/live/${live.live_session_id}/rtmp/host`, { replace: true });          } -        // Kick a status refresh immediately so Cloudflare state is reflected without waiting for first poll tick.          getRtmpLiveStatus(live.live_session_id).then((next) => {            if (!active) return; -          setRtmpStatus(next.status); -          setAppStatus(next.app_status || (next.status === 'ended' ? 'ended' : next.status === 'live' ? 'live' : 'waiting_for_obs')); -          if (next.hls_url) setHlsUrl(next.hls_url); -          setRecordingStatus(next.recording_status || null); -          setArchiveStatus(next.archive_status || null); +          applyLivePayload(next as LivePayload);          }).catch(() => undefined);        } catch (err: unknown) {          if (!active) return; @@ -158,16 +244,21 @@ export default function RtmpHostPage() {    useEffect(() => {      if (!sessionId) return;      const channel = supabase -      .channel(`obs-live-host-${sessionId}`) +      .channel(`obs-live-producer-${sessionId}`)        .on(          'postgres_changes',          { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${sessionId}` },          (payload) => {            const row = payload.new as { -            status?: AppStatus; +            status?: RtmpProducerStatus;              rtmp_status?: RtmpLiveStatus['status'];              hls_url?: string | null;              playback_url?: string | null; +            title?: string | null; +            description?: string | null; +            source_connected_at?: string | null; +            live_post_id?: string | null; +            post_id?: string | null;              recording_status?: string | null;              archive_status?: string | null;              rtmp_started_at?: string | null; @@ -175,6 +266,10 @@ export default function RtmpHostPage() {            setAppStatus(row.status || 'waiting_for_obs');            setRtmpStatus(row.rtmp_status || 'waiting');            if (row.hls_url || row.playback_url) setHlsUrl(row.hls_url || row.playback_url || null); +          if (typeof row.title === 'string' && !detailsDirty) setTitle(row.title); +          if (typeof row.description === 'string' && !detailsDirty) setDescription(row.description); +          setSourceConnectedAt(row.source_connected_at || null); +          setLivePostId(row.live_post_id || row.post_id || null);            setRecordingStatus(row.recording_status || null);            setArchiveStatus(row.archive_status || null);            if (row.rtmp_started_at) setRtmpStartedAt(row.rtmp_started_at); @@ -191,11 +286,10 @@ export default function RtmpHostPage() {        supabase.removeChannel(channel);        stopPolling();      }; -  }, [refreshStatus, sessionId, stopPolling]); +  }, [detailsDirty, refreshStatus, sessionId, stopPolling]);   -  // Tick elapsed time when LIVE so the host sees progress.    useEffect(() => { -    if (rtmpStatus !== 'live' || !rtmpStartedAt) { +    if (!sourceConnected || !rtmpStartedAt) {        setElapsedLabel('');        return;      } @@ -212,7 +306,64 @@ export default function RtmpHostPage() {      setElapsedLabel(compute());      const id = setInterval(() => setElapsedLabel(compute()), 1000);      return () => clearInterval(id); -  }, [rtmpStatus, rtmpStartedAt]); +  }, [rtmpStartedAt, sourceConnected]); + +  const validationText = useMemo(() => { +    if (!sourceConnected) return 'OBS chua ket noi toi Cloudflare.'; +    if (!titleValid) return 'Vui long nhap tieu de.'; +    if (!descriptionValid) return 'Vui long nhap mo ta.'; +    if (!hlsUrl) return 'Dang cho Cloudflare tao playback URL.'; +    return ''; +  }, [descriptionValid, hlsUrl, sourceConnected, titleValid]); + +  const saveDetails = async () => { +    if (!sessionId) return null; +    if (!titleValid) { +      toast.error('Tieu de la bat buoc.'); +      return null; +    } +    if (!descriptionValid) { +      toast.error('Mo ta la bat buoc.'); +      return null; +    } +    setSavingDetails(true); +    try { +      const updated = await saveRtmpLiveDetails(sessionId, { +        title: title.trim(), +        description: description.trim(), +      }); +      applyLivePayload(updated); +      toast.success('Da luu chi tiet bai viet.'); +      return updated; +    } catch (err: unknown) { +      toast.error(getErrorMessage(err, 'Khong the luu chi tiet bai viet.')); +      return null; +    } finally { +      setSavingDetails(false); +    } +  }; + +  const goLive = async () => { +    if (!sessionId) return; +    if (!canGoLive) { +      toast.error(validationText || 'Chua du dieu kien phat truc tiep.'); +      return; +    } +    setGoingLive(true); +    try { +      if (detailsDirty) { +        const saved = await saveDetails(); +        if (!saved) return; +      } +      const live = await goLiveRtmpSession(sessionId); +      applyLivePayload(live); +      toast.success('Da phat truc tiep. Bai LIVE da xuat hien tren feed.'); +    } catch (err: unknown) { +      toast.error(getErrorMessage(err, 'Khong the phat truc tiep.')); +    } finally { +      setGoingLive(false); +    } +  };      const resetKey = async () => {      if (!sessionId) return; @@ -221,7 +372,7 @@ export default function RtmpHostPage() {        applyLivePayload(next);        toast.success('Da tao Stream Key moi.');      } catch (err: unknown) { -      toast.error(getErrorMessage(err, 'Khong the reset Stream Key.')); +      toast.error(getErrorMessage(err, 'Khong the dat lai Stream Key.'));      }    };   @@ -231,8 +382,7 @@ export default function RtmpHostPage() {        await endRtmpLiveSession(sessionId);        setAppStatus('ended');        setRtmpStatus('ended'); -      toast.success('Da gui lenh ket thuc livestream. Replay se duoc xu ly tu Cloudflare va luu vao R2.'); -      navigate(`/live/${sessionId}`); +      toast.success('Da ket thuc livestream. Replay se duoc xu ly va luu sang R2.');      } catch (err: unknown) {        toast.error(getErrorMessage(err, 'Khong the ket thuc livestream.'));      } @@ -243,7 +393,7 @@ export default function RtmpHostPage() {        <div className="min-h-screen flex items-center justify-center">          <div className="flex items-center gap-2 text-muted-foreground">            <Loader2 className="h-6 w-6 animate-spin" /> -          <span>Preparing OBS live...</span> +          <span>Dang chuan bi Live Producer...</span>          </div>        </div>      ); @@ -255,11 +405,11 @@ export default function RtmpHostPage() {          <FacebookNavbar />          <div className="pt-20 px-4 max-w-xl mx-auto">            <Card className="p-6 space-y-4"> -            <div className="font-semibold text-lg">Could not start OBS live</div> +            <div className="font-semibold text-lg">Khong the mo Live Producer</div>              <div className="text-sm text-muted-foreground">{error}</div>              <Button variant="outline" onClick={() => navigate('/')}>                <Home className="h-4 w-4 mr-2" /> -              Back home +              Ve trang chu              </Button>            </Card>          </div> @@ -268,95 +418,94 @@ export default function RtmpHostPage() {    }      const label = statusLabel(appStatus, rtmpStatus, archiveStatus); -  const isLive = appStatus === 'live' || rtmpStatus === 'live'; -  const isEnded = appStatus !== 'waiting_for_obs' && appStatus !== 'live';      return (      <div className="min-h-screen bg-background">        <FacebookNavbar /> -      <main className="pt-16 px-3 md:px-6 pb-6"> -        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4"> -          <section className="space-y-3"> -            <div className="flex items-center justify-between gap-3 flex-wrap"> -              <div> -                <h1 className="text-xl md:text-2xl font-bold">Live bang OBS</h1> -                <p className="text-sm text-muted-foreground">OBS stream truc tiep len Cloudflare Stream Live Input. Tab nay chi la control panel.</p> -              </div> -              <div className="flex items-center gap-2"> -                <Badge variant={isLive ? 'destructive' : isEnded ? 'secondary' : 'outline'} className="gap-1"> -                  <Radio className={`h-3.5 w-3.5 ${isLive ? 'animate-pulse' : ''}`} /> -                  {label} -                </Badge> -                {isLive && ( -                  <span className="text-xs font-mono text-muted-foreground"> -                    {elapsedLabel || '00:00'} • Đang nhận tín hiệu OBS -                  </span> -                )} +      <main className="pt-16 pb-4"> +        <div className="border-b bg-card/70 px-3 md:px-6 py-3"> +          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3"> +            <div className="flex items-center gap-3 min-w-0"> +              <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back"> +                <ArrowLeft className="h-5 w-5" /> +              </Button> +              <div className="min-w-0"> +                <h1 className="text-lg md:text-xl font-bold truncate">Live Producer</h1> +                <p className="text-xs text-muted-foreground truncate">Phan mem phat truc tiep / RTMP / OBS</p>                </div>              </div> +            <div className="flex items-center gap-2"> +              <Badge variant={isPublicLive ? 'destructive' : sourceConnected ? 'default' : 'outline'} className="gap-1"> +                <Radio className={`h-3.5 w-3.5 ${isPublicLive ? 'animate-pulse' : ''}`} /> +                {label} +              </Badge> +              {sourceConnected && elapsedLabel && ( +                <span className="hidden sm:inline text-xs font-mono text-muted-foreground">{elapsedLabel}</span> +              )} +            </div> +          </div> +        </div>   -            <Card className="p-4 space-y-4"> -              <div className="grid gap-3"> -                <div className="space-y-1"> -                  <div className="text-sm font-medium">Server URL</div> -                  <div className="flex gap-2"> -                    <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm break-all">{rtmpsUrl || 'Dang tao RTMPS URL...'}</code> -                    <CopyButton value={rtmpsUrl} label="Copy Server" /> -                  </div> -                </div> -                <div className="space-y-1"> -                  <div className="text-sm font-medium">Stream Key</div> -                  <div className="flex gap-2"> -                    <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm break-all">{streamKey || '••••••••••••••••'}</code> -                    {sessionId && <CopyButton label="Copy Key" onCopyValue={() => getRtmpStreamKeyForCopy(sessionId)} />} -                  </div> -                </div> -              </div> +        <div className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_390px] gap-4 px-3 md:px-6 pt-4"> +          <aside className="space-y-3"> +            <Card className="p-3 space-y-3"> +              <div className="text-sm font-semibold">Tien trinh</div> +              <StepItem +                number={1} +                title="Ket noi nguon video" +                description={sourceConnected ? 'Cloudflare da nhan tin hieu tu OBS.' : 'Sao chep RTMPS URL va Stream Key vao OBS.'} +                state={sourceConnected ? 'completed' : 'pending'} +              /> +              <StepItem +                number={2} +                title="Hoan tat chi tiet bai viet" +                description={detailsValid ? 'Tieu de va mo ta da san sang.' : 'Tieu de va mo ta la bat buoc.'} +                state={detailsValid ? 'completed' : 'warning'} +              /> +              <StepItem +                number={3} +                title="Phat truc tiep" +                description={isPublicLive ? 'Live post dang hien tren feed.' : canGoLive ? 'Da du dieu kien de phat truc tiep.' : 'Chi mo khi OBS, chi tiet va playback da san sang.'} +                state={isPublicLive || canGoLive ? 'completed' : 'pending'} +              /> +            </Card>   -              <div className="text-sm text-muted-foreground leading-6"> -                <div>1. Mo OBS Studio.</div> -                <div>2. Settings {'->'} Stream.</div> -                <div>3. Service {'->'} Custom.</div> -                <div>4. Dan Server URL va Stream Key.</div> -                <div>5. Bam Start Streaming trong OBS. Livestream se tu dong chuyen sang LIVE khi Cloudflare bao connected.</div> -              </div> - -              <div className="flex flex-wrap gap-2"> -                <Button variant="outline" onClick={() => refreshStatus().catch((err) => toast.error(getErrorMessage(err, 'Khong the refresh.')))}> -                  <RefreshCw className="h-4 w-4 mr-2" /> -                  Refresh -                </Button> -                <Button variant="outline" onClick={resetKey} disabled={!sessionId || isLive || isEnded}> -                  <KeyRound className="h-4 w-4 mr-2" /> -                  Reset Stream Key -                </Button> -                <Button variant="destructive" onClick={endLive} disabled={!sessionId || isEnded}> -                  <PhoneOff className="h-4 w-4 mr-2" /> -                  Ket thuc livestream -                </Button> +            <Card className="p-3 space-y-2 text-xs text-muted-foreground leading-5"> +              <div className="font-semibold text-foreground flex items-center gap-2"> +                <AlertTriangle className="h-4 w-4" /> +                Luu y                </div> +              <p>OBS co the dang gui tin hieu nhung viewer se chua thay live cho den khi bam Phat truc tiep.</p> +              <p>Control panel nay co the dong/refresh. OBS moi la nguon video chinh.</p>              </Card> +          </aside>   +          <section className="space-y-4">              <Card className="overflow-hidden">                <div className="aspect-video bg-black">                  <RTMPPlayer -                  src={isEnded ? null : hlsUrl} +                  src={sourceConnected ? hlsUrl : null}                    waitingLabel={ -                    isEnded -                      ? 'Replay dang duoc xu ly va luu sang R2.' -                      : isLive -                        ? 'Dang ket noi luong video tu Cloudflare...' -                        : 'Cloudflare co the tre 20-30 giay sau khi OBS bat dau Start Streaming.' +                    sourceConnected +                      ? 'Dang tai preview tu Cloudflare...' +                      : 'Ket noi phan mem phat truc tiep de xem preview.'                    }                  />                </div>              </Card>                <Card className="p-4"> -              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm"> +              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">                  <div> -                  <div className="text-muted-foreground">Live status</div> -                  <div className="font-medium">{label}</div> +                  <div className="text-muted-foreground">Nguon video</div> +                  <div className="font-medium flex items-center gap-1.5"> +                    {sourceConnected ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <MonitorUp className="h-4 w-4" />} +                    {sourceConnected ? 'Da ket noi' : 'Dang cho'} +                  </div> +                </div> +                <div> +                  <div className="text-muted-foreground">Trang thai public</div> +                  <div className="font-medium">{isPublicLive ? 'Dang live' : isEnded ? 'Da ket thuc' : 'Chua public'}</div>                  </div>                  <div>                    <div className="text-muted-foreground">Recording</div> @@ -368,9 +517,146 @@ export default function RtmpHostPage() {                  </div>                </div>              </Card> + +            {isPublicLive && sessionId && ( +              <Card className="p-4"> +                <div className="flex flex-wrap items-center justify-between gap-3"> +                  <div> +                    <div className="font-semibold">Live post da xuat hien tren feed</div> +                    <div className="text-sm text-muted-foreground">Viewer co the xem live tren feed/profile hoac trang live.</div> +                  </div> +                  <div className="flex gap-2"> +                    <Button variant="outline" onClick={() => navigate(`/live/${sessionId}`)}> +                      <Eye className="h-4 w-4 mr-2" /> +                      Xem nhu viewer +                    </Button> +                    <Button variant="destructive" onClick={endLive}> +                      <PhoneOff className="h-4 w-4 mr-2" /> +                      Ket thuc live +                    </Button> +                  </div> +                </div> +              </Card> +            )}            </section>   -          {sessionId && <LiveChatPanel sessionId={sessionId} className="h-[70vh] lg:h-[calc(100vh-120px)]" />} +          <aside className="space-y-4"> +            <Card className="p-4 space-y-4"> +              <div className="flex items-center justify-between gap-2"> +                <div className="font-semibold flex items-center gap-2"> +                  <Settings2 className="h-4 w-4" /> +                  Nguon video +                </div> +                <Badge variant="outline">RTMP/OBS</Badge> +              </div> + +              <div className="space-y-3"> +                <div className="space-y-1.5"> +                  <div className="text-sm font-medium">URL may chu / RTMPS URL</div> +                  <div className="flex gap-2"> +                    <code className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 text-xs break-all">{rtmpsUrl || 'Dang tao RTMPS URL...'}</code> +                    <CopyButton value={rtmpsUrl} label="URL" /> +                  </div> +                </div> + +                <div className="space-y-1.5"> +                  <div className="text-sm font-medium">Stream Key</div> +                  <div className="flex gap-2"> +                    <code className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 text-xs break-all">{streamKey || '****************'}</code> +                    {sessionId && <CopyButton label="Key" onCopyValue={() => getRtmpStreamKeyForCopy(sessionId)} />} +                  </div> +                </div> +              </div> + +              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground leading-5"> +                <div>OBS {'->'} Settings {'->'} Stream</div> +                <div>Service = Custom</div> +                <div>Server = RTMPS URL</div> +                <div>Stream Key = Stream Key</div> +                <div>Start Streaming trong OBS, sau do quay lai day de Phat truc tiep.</div> +              </div> + +              <div className="flex flex-wrap gap-2"> +                <Button variant="outline" size="sm" onClick={() => refreshStatus().catch((err) => toast.error(getErrorMessage(err, 'Khong the refresh.')))}> +                  <RefreshCw className="h-4 w-4 mr-2" /> +                  Lam moi +                </Button> +                <Button variant="outline" size="sm" onClick={resetKey} disabled={!sessionId || sourceConnected || isPublicLive || isEnded}> +                  <KeyRound className="h-4 w-4 mr-2" /> +                  Dat lai Stream Key +                </Button> +              </div> + +              {sourceConnectedAt && ( +                <div className="text-xs text-emerald-700 dark:text-emerald-400"> +                  OBS da ket noi luc {new Date(sourceConnectedAt).toLocaleString()}. +                </div> +              )} +            </Card> + +            <Card className="p-4 space-y-4"> +              <div className="font-semibold flex items-center gap-2"> +                <FileText className="h-4 w-4" /> +                Chi tiet bai viet +              </div> + +              <div className="space-y-2"> +                <label className="text-sm font-medium" htmlFor="live-title">Tieu de</label> +                <Input +                  id="live-title" +                  value={title} +                  onChange={(event) => setTitle(event.target.value)} +                  onBlur={() => { +                    if (detailsValid && detailsDirty) saveDetails().catch(() => undefined); +                  }} +                  placeholder="Nhap tieu de livestream" +                  disabled={isPublicLive || isEnded} +                /> +                {!titleValid && <div className="text-xs text-destructive">Tieu de la bat buoc.</div>} +              </div> + +              <div className="space-y-2"> +                <label className="text-sm font-medium" htmlFor="live-description">Mo ta</label> +                <Textarea +                  id="live-description" +                  value={description} +                  onChange={(event) => setDescription(event.target.value)} +                  onBlur={() => { +                    if (detailsValid && detailsDirty) saveDetails().catch(() => undefined); +                  }} +                  placeholder="Mo ta noi dung buoi live" +                  className="min-h-[110px]" +                  disabled={isPublicLive || isEnded} +                /> +                {!descriptionValid && <div className="text-xs text-destructive">Mo ta la bat buoc.</div>} +              </div> + +              <Button variant="outline" onClick={saveDetails} disabled={!detailsValid || savingDetails || isPublicLive || isEnded || !detailsDirty}> +                {savingDetails ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />} +                Luu chi tiet +              </Button> +            </Card> + +            <Card className="p-4 space-y-3"> +              <Button className="w-full" size="lg" onClick={goLive} disabled={!canGoLive || goingLive}> +                {goingLive ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />} +                Phat truc tiep +              </Button> +              {!canGoLive && !isPublicLive && ( +                <div className="text-xs text-muted-foreground leading-5">{validationText}</div> +              )} +              {isPublicLive && livePostId && ( +                <div className="text-xs text-emerald-700 dark:text-emerald-400">Live post ID: {livePostId}</div> +              )} +              {isEnded && sessionId && ( +                <Button variant="outline" className="w-full" onClick={() => navigate(`/live/${sessionId}`)}> +                  Xem replay/status +                </Button> +              )} +            </Card> + +            {sessionId && isPublicLive && <LiveChatPanel sessionId={sessionId} className="h-[360px]" />} +          </aside>          </div>        </main>      </div> diff --git a/src/modules/live/rtmpService.ts b/src/modules/live/rtmpService.ts index 08c7706..24a65c0 100644 --- a/src/modules/live/rtmpService.ts +++ b/src/modules/live/rtmpService.ts @@ -1,6 +1,17 @@  import { supabase } from '@/integrations/supabase/client';  import type { RtmpStatus } from './types';   +export type RtmpProducerStatus = +  | 'waiting_for_obs' +  | 'source_connected' +  | 'ready_to_go_live' +  | 'live' +  | 'ended' +  | 'processing' +  | 'archiving' +  | 'posted' +  | 'failed'; +  type RtmpLiveResponse = {    live_session_id: string;    stream_key: string | null; @@ -8,11 +19,19 @@ type RtmpLiveResponse = {    rtmps_url?: string | null;    hls_url: string;    status: RtmpStatus; -  app_status?: 'waiting_for_obs' | 'live' | 'ended' | 'processing' | 'archiving' | 'posted' | 'failed'; +  app_status?: RtmpProducerStatus;    live_mode?: 'rtmp' | 'rtmp_obs';    mode?: 'rtmp_obs';    stream_provider?: 'nginx_rtmp' | 'cloudflare_stream';    cloudflare_live_input_id?: string | null; +  title?: string | null; +  description?: string | null; +  source_connected_at?: string | null; +  go_live_clicked_at?: string | null; +  live_post_id?: string | null; +  replay_post_id?: string | null; +  rtmp_started_at?: string | null; +  started_at?: string | null;    recording_status?: string | null;    archive_status?: string | null;  }; @@ -22,7 +41,14 @@ export type RtmpLiveStatus = {    stream_key?: string | null;    status: RtmpStatus;    hls_url: string | null; -  app_status: 'waiting_for_obs' | 'live' | 'ended' | 'processing' | 'archiving' | 'posted' | 'failed'; +  app_status: RtmpProducerStatus; +  title?: string | null; +  description?: string | null; +  source_connected_at?: string | null; +  go_live_clicked_at?: string | null; +  live_post_id?: string | null; +  rtmp_started_at?: string | null; +  started_at?: string | null;    recording_status?: string | null;    archive_status?: string | null;  }; @@ -73,6 +99,25 @@ export async function endRtmpLiveSession(sessionId: string): Promise<void> {    });  }   +export async function saveRtmpLiveDetails(sessionId: string, input: { +  title: string; +  description: string; +}): Promise<RtmpLiveResponse> { +  return invokeRtmp<RtmpLiveResponse>({ +    action: 'save-details', +    live_session_id: sessionId, +    title: input.title, +    description: input.description, +  }); +} + +export async function goLiveRtmpSession(sessionId: string): Promise<RtmpLiveResponse> { +  return invokeRtmp<RtmpLiveResponse>({ +    action: 'go-live', +    live_session_id: sessionId, +  }); +} +  export async function startRtmpLiveSession(sessionId: string): Promise<RtmpLiveResponse> {    return invokeRtmp<RtmpLiveResponse>({      action: 'start', diff --git a/src/modules/live/types.ts b/src/modules/live/types.ts index 8183722..4661891 100644 --- a/src/modules/live/types.ts +++ b/src/modules/live/types.ts @@ -1,5 +1,15 @@  export type LivePrivacy = 'public' | 'friends'; -export type LiveStatus = 'created' | 'waiting_for_obs' | 'live' | 'ended' | 'processing' | 'archiving' | 'posted' | 'failed'; +export type LiveStatus = +  | 'created' +  | 'waiting_for_obs' +  | 'source_connected' +  | 'ready_to_go_live' +  | 'live' +  | 'ended' +  | 'processing' +  | 'archiving' +  | 'posted' +  | 'failed';  export type LiveSource = 'agora' | 'rtmp';  export type LiveMode = 'webcam' | 'rtmp' | 'rtmp_obs';  export type StreamProvider = 'agora' | 'nginx_rtmp' | 'cloudflare_stream'; diff --git a/supabase/functions/_shared/archiveReplay.ts b/supabase/functions/_shared/archiveReplay.ts index f97862e..00346bc 100644 --- a/supabase/functions/_shared/archiveReplay.ts +++ b/supabase/functions/_shared/archiveReplay.ts @@ -286,7 +286,7 @@ export async function archiveReplayToR2(params: {      const { data: live, error: liveError } = await params.supabase      .from("live_sessions") -    .select("id, post_id, host_user_id, owner_id, title, cloudflare_video_uid") +    .select("id, post_id, live_post_id, replay_post_id, host_user_id, owner_id, title, cloudflare_video_uid")      .eq("id", replay.live_session_id)      .maybeSingle();    if (liveError) throw liveError; @@ -529,7 +529,7 @@ export async function archiveReplayToR2(params: {        .eq("id", live.id);    }   -  let postId = live?.post_id ?? null; +  let postId = live?.replay_post_id ?? live?.post_id ?? live?.live_post_id ?? null;    try {      if (!postId) {        const { data: insertedPost, error: insertPostError } = await params.supabase @@ -546,7 +546,7 @@ export async function archiveReplayToR2(params: {        if (insertPostError) throw insertPostError;        postId = insertedPost.id;        if (live?.id) { -        await params.supabase.from("live_sessions").update({ post_id: postId, posted_at: archivedAt }).eq("id", live.id); +        await params.supabase.from("live_sessions").update({ post_id: postId, replay_post_id: postId, posted_at: archivedAt }).eq("id", live.id);        }      }   @@ -607,7 +607,7 @@ export async function archiveReplayToR2(params: {    if (live?.id) {      await params.supabase        .from("live_sessions") -      .update({ status: "archiving", archive_status: "stream_delete_pending", posted_at: archivedAt, updated_at: archivedAt }) +      .update({ status: "archiving", archive_status: "stream_delete_pending", replay_post_id: postId, posted_at: archivedAt, updated_at: archivedAt })        .eq("id", live.id);    }   diff --git a/supabase/functions/live-rtmp/index.ts b/supabase/functions/live-rtmp/index.ts index 7939497..4ca8afa 100644 --- a/supabase/functions/live-rtmp/index.ts +++ b/supabase/functions/live-rtmp/index.ts @@ -16,6 +16,16 @@ const corsHeaders = {    type SupabaseAdmin = ReturnType<typeof createClient>;  type RtmpStatus = "idle" | "waiting" | "live" | "ended"; +type ProducerStatus = +  | "waiting_for_obs" +  | "source_connected" +  | "ready_to_go_live" +  | "live" +  | "ended" +  | "processing" +  | "archiving" +  | "posted" +  | "failed";    function json(data: unknown, status = 200) {    return new Response(JSON.stringify(data), { @@ -98,11 +108,85 @@ function toResponse(row: Record<string, unknown>, options: { streamKey?: string      mode: "rtmp_obs",      stream_provider: "cloudflare_stream",      cloudflare_live_input_id: liveInputId || null, +    title: row.title ?? "", +    description: row.description ?? "", +    source_connected_at: row.source_connected_at ?? null, +    go_live_clicked_at: row.go_live_clicked_at ?? null, +    live_post_id: row.live_post_id ?? row.post_id ?? null, +    replay_post_id: row.replay_post_id ?? null, +    rtmp_started_at: row.rtmp_started_at ?? null, +    started_at: row.started_at ?? null,      recording_status: row.recording_status ?? null,      archive_status: row.archive_status ?? null,    };  }   +function detailsAreValid(row: Record<string, unknown>) { +  return String(row.title || "").trim().length > 0 && String(row.description || "").trim().length > 0; +} + +function producerStatusFor(row: Record<string, unknown>, connected: boolean): ProducerStatus { +  if (["live", "ended", "processing", "archiving", "posted", "failed"].includes(String(row.status))) { +    return String(row.status) as ProducerStatus; +  } +  if (!connected) return "waiting_for_obs"; +  return detailsAreValid(row) ? "ready_to_go_live" : "source_connected"; +} + +async function createOrUpdateLivePost(params: { +  admin: SupabaseAdmin; +  live: Record<string, unknown>; +  userId: string; +  hlsUrl: string; +}) { +  const { admin, live, userId, hlsUrl } = params; +  const now = new Date().toISOString(); +  const metadata = { +    live_session_id: live.id, +    live_title: String(live.title || "").trim(), +    title: String(live.title || "").trim(), +    description: String(live.description || "").trim(), +    live_status: "live", +    badge: "LIVE", +    media_type: "live_video", +    live_mode: "rtmp_obs", +    mode: "rtmp_obs", +    stream_provider: "cloudflare_stream", +    playback_provider: "cloudflare_stream", +    playback_url: hlsUrl, +    hls_url: hlsUrl, +    hls_playback_url: hlsUrl, +    cloudflare_live_input_id: live.cloudflare_live_input_id, +    viewer_count: live.viewer_count ?? 0, +    go_live_clicked_at: now, +  }; + +  const existingPostId = String(live.live_post_id || live.post_id || ""); +  if (existingPostId) { +    await mergePostMetadata(admin, existingPostId, metadata, { +      content: String(live.title || "").trim(), +      video_url: hlsUrl, +      post_type: "live", +    }); +    return existingPostId; +  } + +  const { data: post, error: postError } = await admin +    .from("posts") +    .insert({ +      user_id: userId, +      content: String(live.title || "").trim(), +      visibility: live.privacy === "friends" ? "friends" : "public", +      post_type: "live", +      video_url: hlsUrl, +      metadata, +    }) +    .select("id") +    .single(); +  if (postError) throw postError; +  return post.id as string; +} +  async function requireOwnedRtmpSession(admin: SupabaseAdmin, sessionId: string, userId: string) {    const { data, error: sessionError } = await admin      .from("live_sessions") @@ -135,6 +219,23 @@ Deno.serve(async (req) => {      if (!user) return error("Authorization required", 401);        if (action === "create") { +      const { data: existing, error: existingError } = await admin +        .from("live_sessions") +        .select("*") +        .eq("host_user_id", user.id) +        .eq("mode", "rtmp_obs") +        .is("deleted_at", null) +        .in("status", ["waiting_for_obs", "source_connected", "ready_to_go_live", "live"]) +        .order("updated_at", { ascending: false }) +        .limit(1) +        .maybeSingle(); +      if (existingError) throw existingError; +      if (existing) { +        const encryptedExistingKey = typeof existing.stream_key_encrypted === "string" ? existing.stream_key_encrypted : ""; +        const existingKey = encryptedExistingKey ? await decryptStreamKey(encryptedExistingKey) : null; +        return json(toResponse(existing, { streamKey: existingKey, reveal: true })); +      } +        const title = String(body.title || "").trim();        const description = String(body.description || "").trim();        const privacy = body.privacy === "friends" ? "friends" : "public"; @@ -167,6 +268,7 @@ Deno.serve(async (req) => {            stream_key: null,            stream_key_encrypted: await encryptStreamKey(streamKey),            stream_key_last_shown_at: now, +          stream_key_last_reset_at: now,            rtmp_status: "waiting",            hls_url: playback,            hls_playback_url: playback, @@ -233,17 +335,33 @@ Deno.serve(async (req) => {            }            if (isLive) {              const now = new Date().toISOString(); -            patch.status = "live"; +            const nextStatus = producerStatusFor(row, true); +            patch.status = nextStatus;              patch.rtmp_status = "live"; -            patch.started_at = row.started_at ?? now;              patch.rtmp_started_at = row.rtmp_started_at ?? now; +            patch.source_connected_at = row.source_connected_at ?? now;              patch.recording_status = "recording"; -            row.status = "live"; +            row.status = nextStatus;              row.rtmp_status = "live"; +            row.rtmp_started_at = row.rtmp_started_at ?? now; +            row.source_connected_at = row.source_connected_at ?? now;              row.recording_status = "recording";            } else if (isDisconnected && row.rtmp_status === "live") { -            patch.rtmp_status = "waiting"; -            row.rtmp_status = "waiting"; +            if (row.status === "live") { +              const now = new Date().toISOString(); +              patch.status = "ended"; +              patch.rtmp_status = "ended"; +              patch.ended_at = row.ended_at ?? now; +              patch.rtmp_ended_at = row.rtmp_ended_at ?? now; +              patch.recording_status = "processing"; +              row.status = "ended"; +              row.rtmp_status = "ended"; +            } else { +              patch.status = "waiting_for_obs"; +              patch.rtmp_status = "waiting"; +              row.status = "waiting_for_obs"; +              row.rtmp_status = "waiting"; +            }            }              // Link cloudflare_video_uid as soon as Cloudflare exposes a recorded video @@ -265,8 +383,70 @@ Deno.serve(async (req) => {        return json(toResponse(row, { streamKey, reveal: false }));      }   +    if (action === "save-details" || action === "update-details") { +      if (row.status === "ended" || row.status === "posted") return error("Cannot update details after live ended", 409); +      const title = String(body.title || "").trim(); +      const description = String(body.description || "").trim(); +      if (!title) return error("Title is required", 400); +      if (!description) return error("Description is required", 400); +      const connected = row.rtmp_status === "live" || row.status === "source_connected" || row.status === "ready_to_go_live" || row.status === "live"; +      const nextStatus = row.status === "live" ? "live" : connected ? "ready_to_go_live" : "waiting_for_obs"; +      const now = new Date().toISOString(); +      const { data: updated, error: updateError } = await admin +        .from("live_sessions") +        .update({ +          title, +          description, +          status: nextStatus, +          updated_at: now, +        }) +        .eq("id", sessionId) +        .select("*") +        .single(); +      if (updateError) throw updateError; +      return json(toResponse(updated, { streamKey, reveal: false })); +    } + +    if (action === "go-live" || action === "go_live") { +      const title = String(row.title || "").trim(); +      const description = String(row.description || "").trim(); +      if (!title) return error("Title is required before going live", 400); +      if (!description) return error("Description is required before going live", 400); +      if (row.rtmp_status !== "live" && row.status !== "source_connected" && row.status !== "ready_to_go_live") { +        return error("OBS source is not connected", 409); +      } +      const hlsUrl = String(row.hls_url || row.hls_playback_url || row.playback_url || ""); +      if (!hlsUrl) return error("Playback URL is not ready yet", 409); + +      const now = new Date().toISOString(); +      const livePostId = await createOrUpdateLivePost({ admin, live: row, userId: user.id, hlsUrl }); +      const { data: updated, error: updateError } = await admin +        .from("live_sessions") +        .update({ +          status: "live", +          rtmp_status: "live", +          started_at: row.started_at ?? now, +          go_live_clicked_at: row.go_live_clicked_at ?? now, +          source_connected_at: row.source_connected_at ?? now, +          live_post_id: livePostId, +          post_id: livePostId, +          playback_url: hlsUrl, +          hls_url: hlsUrl, +          hls_playback_url: hlsUrl, +          recording_status: "recording", +          updated_at: now, +        }) +        .eq("id", sessionId) +        .select("*") +        .single(); +      if (updateError) throw updateError; +      return json({ ...toResponse(updated, { streamKey, reveal: false }), live_post_id: livePostId }); +    } +      if (action === "regenerate" || action === "reset-stream-key") { -      if (row.status === "live" || row.rtmp_status === "live") return error("Cannot reset stream key while live", 409); +      if (row.status === "live" || row.rtmp_status === "live" || row.status === "source_connected" || row.status === "ready_to_go_live") { +        return error("Cannot reset stream key while OBS is connected or live", 409); +      }        if (row.status === "ended") return error("Cannot reset stream key after live ended", 409);          if (row.cloudflare_live_input_id) { @@ -294,7 +474,12 @@ Deno.serve(async (req) => {            stream_key: null,            stream_key_encrypted: await encryptStreamKey(nextKey),            stream_key_last_shown_at: now, +          stream_key_last_reset_at: now,            rtmp_status: "waiting", +          status: "waiting_for_obs", +          source_connected_at: null, +          go_live_clicked_at: null, +          cloudflare_video_uid: null,            hls_url: playback,            hls_playback_url: playback,            playback_url: playback, diff --git a/supabase/functions/stream-webhook/index.ts b/supabase/functions/stream-webhook/index.ts index e74d7f6..0031a2c 100644 --- a/supabase/functions/stream-webhook/index.ts +++ b/supabase/functions/stream-webhook/index.ts @@ -206,31 +206,33 @@ async function handleObsLiveEvent(params: {      buildUrls(liveInputId, customerCode).hls;      if (isConnected) { -    const postId = await ensureLivePostForObs(supabase, live, playbackHls); +    const hasDetails = String(live.title || "").trim().length > 0 && String(live.description || "").trim().length > 0; +    const nextStatus = live.status === "live" ? "live" : hasDetails ? "ready_to_go_live" : "source_connected";      await supabase        .from("live_sessions")        .update({ -        status: "live", +        status: nextStatus,          rtmp_status: "live",          rtmp_started_at: live.rtmp_started_at ?? now, -        started_at: live.started_at ?? now, +        source_connected_at: live.source_connected_at ?? now,          recording_status: "recording",          playback_url: playbackHls,          hls_url: playbackHls,          hls_playback_url: playbackHls, -        post_id: postId,          updated_at: now,        })        .eq("id", live.id); -    await mergePostMetadata(supabase, postId, { -      live_session_id: live.id, -      live_status: "live", -      replay_status: null, -      archive_status: "pending", -      hls_url: playbackHls, -      hls_playback_url: playbackHls, -      playback_url: playbackHls, -    }); +    if (live.status === "live" && (live.live_post_id || live.post_id)) { +      await mergePostMetadata(supabase, String(live.live_post_id || live.post_id), { +        live_session_id: live.id, +        live_status: "live", +        replay_status: null, +        archive_status: "pending", +        hls_url: playbackHls, +        hls_playback_url: playbackHls, +        playback_url: playbackHls, +      }); +    }      return true;    }   @@ -241,22 +243,23 @@ async function handleObsLiveEvent(params: {        resolvedVideoUid = await resolveLatestVideoUidForLiveInput(liveInputId);      }   +    const wasPublic = live.status === "live" || !!live.go_live_clicked_at || !!live.live_post_id || !!live.post_id;      await supabase        .from("live_sessions")        .update({ -        status: "ended", +        status: wasPublic ? "ended" : "waiting_for_obs",          rtmp_status: "ended",          rtmp_ended_at: live.rtmp_ended_at ?? now, -        ended_at: live.ended_at ?? now, -        recording_status: "processing", +        ended_at: wasPublic ? live.ended_at ?? now : live.ended_at, +        recording_status: wasPublic ? "processing" : "idle",          archive_status: "pending",          cloudflare_video_uid: resolvedVideoUid ?? live.cloudflare_video_uid ?? null,          updated_at: now,        })        .eq("id", live.id);   -    if (live.post_id) { -      await mergePostMetadata(supabase, String(live.post_id), { +    if (wasPublic && (live.live_post_id || live.post_id)) { +      await mergePostMetadata(supabase, String(live.live_post_id || live.post_id), {          live_session_id: live.id,          live_status: "ended",          live_mode: "rtmp_obs", @@ -270,7 +273,7 @@ async function handleObsLiveEvent(params: {      }        // Kick off archive pipeline ASAP (non-blocking on failure — retry-archive-replays will catch up). -    if (resolvedVideoUid) { +    if (wasPublic && resolvedVideoUid) {        archiveReplayToR2({ supabase, liveSessionId: String(live.id) }).catch((err) => {          console.warn("[stream-webhook] archiveReplayToR2 (disconnected) failed", err);        }); @@ -467,15 +470,17 @@ Deno.serve(async (req) => {          const { data: live } = await supabase          .from("live_sessions") -        .select("id, post_id") +        .select("id, post_id, live_post_id, status, go_live_clicked_at")          .eq("id", updatedReplay.live_session_id)          .maybeSingle(); +      const wasPublic = live?.status === "live" || live?.status === "ended" || !!live?.go_live_clicked_at || !!live?.live_post_id || !!live?.post_id;   -      if (live?.post_id) { +      if (wasPublic && (live?.live_post_id || live?.post_id)) { +        const livePostId = live.live_post_id || live.post_id;          const { data: post } = await supabase            .from("posts")            .select("metadata") -          .eq("id", live.post_id) +          .eq("id", livePostId)            .maybeSingle();          const metadata = {            ...((post?.metadata as Record<string, unknown> | null) || {}), @@ -496,7 +501,7 @@ Deno.serve(async (req) => {          await supabase            .from("posts")            .update({ video_url: playbackHls, metadata }) -          .eq("id", live.post_id); +          .eq("id", livePostId);        }     @@ -504,7 +509,7 @@ Deno.serve(async (req) => {          .from("live_sessions")          .update({            recording_status: "ready", -          status: "processing", +          status: wasPublic ? "processing" : "waiting_for_obs",            archive_status: "pending",            cloudflare_playback_url: playbackHls,            cloudflare_mp4_download_url: playbackMp4, @@ -515,7 +520,9 @@ Deno.serve(async (req) => {          })          .eq("id", updatedReplay.live_session_id);   -      await archiveReplayToR2({ supabase, replayId: replay.id }); +      if (wasPublic) { +        await archiveReplayToR2({ supabase, replayId: replay.id }); +      }      } else if (state === "error") {        await supabase          .from("live_replays")
````
