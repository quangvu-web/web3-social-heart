# OBS/RTMP Livestream via Cloudflare Stream Live Input Package

> Package generated for Lovable. This feature adds OBS/RTMP livestreaming to Fun Profile using Cloudflare Stream Live Input for ingest/recording/transcoding, then archives replay MP4 to Cloudflare R2 for long-term playback.

## Feature Name

**OBS/RTMP Livestream via Cloudflare Stream Live Input**

Long name: **Fun Profile OBS Livestream Pipeline with Cloudflare Stream Live Input and R2 Replay Archive**

Suggested module id: `OBS_RTMP_CLOUDFLARE_LIVE_INPUT_R2_REPLAY_PIPELINE`

## Architecture

```text
Creator clicks Live bằng OBS
  -> Supabase Edge Function creates Cloudflare Stream Live Input
  -> Backend stores Live Input id + RTMPS URL + encrypted Stream Key
  -> Creator copies RTMPS URL and Stream Key into OBS
  -> OBS pushes RTMPS directly to Cloudflare Stream
  -> Browser tab is only a control panel and can be closed/refreshed
  -> Cloudflare webhook connected updates session to LIVE and creates live feed post
  -> Viewers watch Cloudflare HLS while live
  -> Cloudflare webhook disconnected ends session and starts replay processing
  -> Cloudflare video READY triggers MP4 export
  -> Backend downloads MP4, uploads to R2, verifies HEAD
  -> Replay/feed post and creator_library point to R2 MP4
  -> Cloudflare Stream video is deleted only after R2 archive succeeds
```

## Non-Negotiable Behavior

- Agora webcam live remains intact and separate.
- OBS/RTMP live does not depend on browser MediaStream/WebRTC.
- Closing or refreshing the creator tab must not end OBS livestream.
- Livestream state is driven by Cloudflare webhook/events, not tab state.
- Cloudflare Stream is only temporary ingest/recording/transcoding.
- R2 is the long-term replay source.
- Stream video must never be deleted before R2 upload + R2 HEAD verify + DB/post update succeeds.
- Every OBS livestream, including very short test streams, must be archived and posted when Cloudflare provides the recording.

## Main Files

- `supabase/migrations/20260508103000_cloudflare_stream_obs_live_input.sql`
- `supabase/functions/_shared/cloudflareStreamService.ts`
- `supabase/functions/_shared/streamKeyCrypto.ts`
- `supabase/functions/live-rtmp/index.ts`
- `supabase/functions/stream-webhook/index.ts`
- `supabase/functions/_shared/archiveReplay.ts`
- `supabase/functions/archive-replay-to-r2/index.ts`
- `supabase/functions/retry-archive-replays/index.ts`
- `supabase/functions/_shared/postVideoDelete.ts`
- `supabase/functions/delete-post/index.ts`
- `supabase/functions/retry-post-video-deletes/index.ts`
- `src/modules/live/rtmpService.ts`
- `src/modules/live/pages/RtmpHostPage.tsx`
- `src/modules/live/pages/LiveAudiencePage.tsx`
- `src/modules/live/hooks/useLiveReplay.ts`
- `src/modules/live/liveService.ts`
- `src/modules/live/types.ts`
- `src/modules/live/components/StartLiveDialog.tsx`
- `src/modules/live/components/RTMPPlayer.tsx`
- `src/modules/live/components/HlsPlayer.tsx`
- `src/integrations/supabase/types.ts`
- `supabase/config.toml`

## Environment Variables

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_STREAM_API_TOKEN
CLOUDFLARE_STREAM_TOKEN
CLOUDFLARE_API_TOKEN
CLOUDFLARE_STREAM_WEBHOOK_SECRET
CLOUDFLARE_STREAM_CUSTOMER_CODE
STREAM_KEY_ENCRYPTION_SECRET
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_ENDPOINT
R2_PUBLIC_DOMAIN
CLOUDFLARE_R2_PUBLIC_URL
R2_SIGNED_URL_EXPIRES_SECONDS
CRON_SECRET
SCHEDULED_FUNCTION_SECRET
```

Important: `STREAM_KEY_ENCRYPTION_SECRET` must be at least 32 characters. Do not expose Cloudflare/R2 secrets to frontend.

## Backend API Contract

Supabase Edge Function: `live-rtmp`

- `action=create`: creates Cloudflare Stream Live Input and returns RTMPS URL + Stream Key to owner.
- `action=host-session` / `credentials` / `stream-credentials`: returns credentials only to owner.
- `action=copy-stream-key`: decrypts and returns stream key only to owner.
- `action=status`: checks DB/Cloudflare status for owner control panel.
- `action=reset-stream-key`: disables old Live Input and creates a new one before going live.
- `action=end`: disables Live Input and marks session ended/processing without deleting recording.

Webhook function: `stream-webhook`

- Verifies Cloudflare webhook signature.
- Handles live connected/disconnected events by `cloudflare_live_input_id`.
- Handles Stream video READY by creating/updating `live_replays` and running archive-to-R2 pipeline.

## Deployment Notes

1. Apply migration `20260508103000_cloudflare_stream_obs_live_input.sql`.
2. Deploy Supabase functions: `live-rtmp`, `stream-webhook`, `archive-replay-to-r2`, `retry-archive-replays`, `delete-post`, `retry-post-video-deletes`.
3. Configure Cloudflare Stream webhook to call `stream-webhook`.
4. Schedule `retry-archive-replays` every 10-15 minutes.
5. Schedule `retry-post-video-deletes` for post/video cleanup.
6. Confirm R2 public domain or signed URL strategy is ready before production replay.

## OBS Test Plan

1. Open Fun Profile and click `Live bằng OBS`.
2. Copy Server URL and Stream Key.
3. OBS Studio -> Settings -> Stream -> Service Custom.
4. Paste RTMPS URL and Stream Key.
5. Click Start Streaming in OBS.
6. Confirm Cloudflare webhook updates session to LIVE and creates live feed post.
7. Open `/live/{sessionId}` as viewer and confirm HLS playback.
8. Refresh/close creator tab while OBS keeps streaming; live must continue.
9. Stop Streaming in OBS; Cloudflare disconnected event should end session and start recording processing.
10. Confirm video READY triggers MP4 export, R2 upload, replay post/library update, and Stream delete.

## Verification Already Run

```text
npx tsc --noEmit
npm run build
```

Note: Deno typecheck was not run locally because `deno` was not installed in PATH.

## Rollback / Failure Handling

- If R2 upload fails, keep Cloudflare Stream video, set `archive_status=failed`, store `archive_error`, and retry later.
- If replay post creation/update fails, do not delete Cloudflare Stream video; retry archive pipeline.
- If Stream delete fails after R2 archive, keep R2 as source and retry Stream delete idempotently.
- If creator deletes replay post, `delete-post` soft deletes post and cleanup job deletes R2 object and any remaining Stream UID.

## Source Code

### `supabase/migrations/20260508103000_cloudflare_stream_obs_live_input.sql`

````sql
-- Cloudflare Stream Live Input support for OBS/RTMP.
-- Agora webcam live remains unchanged. OBS sessions use Cloudflare Stream only
-- as ingest/recording/transcoding, then archive replay MP4 to R2.

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS mode text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS rtmps_url text,
  ADD COLUMN IF NOT EXISTS stream_key_encrypted text,
  ADD COLUMN IF NOT EXISTS stream_key_last_shown_at timestamptz,
  ADD COLUMN IF NOT EXISTS playback_url text,
  ADD COLUMN IF NOT EXISTS storage_provider text,
  ADD COLUMN IF NOT EXISTS playback_provider text,
  ADD COLUMN IF NOT EXISTS archive_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS archive_error text,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.live_sessions
SET mode = CASE
    WHEN COALESCE(live_mode, '') IN ('rtmp', 'rtmp_obs') OR COALESCE(source, '') = 'rtmp' THEN 'rtmp_obs'
    ELSE 'agora'
  END
WHERE mode IS NULL;

UPDATE public.live_sessions
SET live_mode = 'rtmp_obs'
WHERE COALESCE(source, '') = 'rtmp'
  AND COALESCE(stream_provider, '') = 'cloudflare_stream';

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_status_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_status_check
  CHECK (status IN ('waiting_for_obs', 'live', 'ended'));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_source_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_source_check
  CHECK (source IN ('agora', 'rtmp'));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_mode_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_mode_check
  CHECK (mode IN ('agora', 'rtmp_obs'));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_live_mode_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_live_mode_check
  CHECK (live_mode IN ('webcam', 'rtmp', 'rtmp_obs'));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_stream_provider_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_stream_provider_check
  CHECK (stream_provider IN ('agora', 'nginx_rtmp', 'cloudflare_stream'));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_rtmp_status_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_rtmp_status_check
  CHECK (rtmp_status IN ('idle', 'waiting', 'live', 'ended'));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_storage_provider_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_storage_provider_check
  CHECK (storage_provider IS NULL OR storage_provider IN ('cloudflare_stream', 'r2'));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_playback_provider_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_playback_provider_check
  CHECK (playback_provider IS NULL OR playback_provider IN ('cloudflare_stream', 'r2'));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_archive_status_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_archive_status_check
  CHECK (archive_status IN ('pending', 'mp4_pending', 'archiving', 'archived', 'failed'));

CREATE INDEX IF NOT EXISTS idx_live_sessions_obs_owner_status
  ON public.live_sessions(host_user_id, status, created_at DESC)
  WHERE mode = 'rtmp_obs';

CREATE INDEX IF NOT EXISTS idx_live_sessions_obs_live_input
  ON public.live_sessions(cloudflare_live_input_id)
  WHERE cloudflare_live_input_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_live_sessions_obs_deleted_at
  ON public.live_sessions(deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN public.live_sessions.stream_key_encrypted IS
  'AES-GCM encrypted Cloudflare Stream Live Input key. Only Edge Functions should decrypt it.';


````

### `supabase/functions/_shared/cloudflareStreamService.ts`

````ts
type CloudflareEnv = {
  accountId: string;
  token: string;
  customerCode: string;
};

export type CloudflareLiveInput = {
  uid: string;
  status?: string;
  rtmps?: {
    url?: string;
    streamKey?: string;
  };
  recording?: {
    mode?: string;
  };
};

export function getCloudflareStreamEnv(): CloudflareEnv {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
  const token =
    Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN") ??
    Deno.env.get("CLOUDFLARE_STREAM_TOKEN") ??
    Deno.env.get("CLOUDFLARE_API_TOKEN") ??
    "";
  const customerCode = Deno.env.get("CLOUDFLARE_STREAM_CUSTOMER_CODE") ?? "";
  if (!accountId || !token) throw new Error("Missing Cloudflare Stream configuration");
  return { accountId, token, customerCode };
}

export function buildStreamPlaybackUrls(uid: string, customerCode = Deno.env.get("CLOUDFLARE_STREAM_CUSTOMER_CODE") ?? "") {
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

async function streamApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const env = getCloudflareStreamEnv();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.accountId}/stream${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    const detail =
      payload?.errors?.map((item: { message?: string }) => item.message).filter(Boolean).join("; ") ||
      payload?.error ||
      `HTTP ${response.status}`;
    throw new Error(`Cloudflare Stream API failed: ${detail}`);
  }
  return payload?.result as T;
}

export async function createLiveInput(input: {
  liveSessionId: string;
  userId: string;
  title: string;
  description?: string;
}): Promise<CloudflareLiveInput> {
  const result = await streamApi<CloudflareLiveInput>("/live_inputs", {
    method: "POST",
    body: JSON.stringify({
      meta: {
        live_session_id: input.liveSessionId,
        user_id: input.userId,
        title: input.title,
        description: input.description ?? "",
        source: "funprofile_obs_rtmp",
      },
      recording: {
        mode: "automatic",
        requireSignedURLs: false,
      },
    }),
  });

  if (!result?.uid || !result.rtmps?.url || !result.rtmps?.streamKey) {
    throw new Error("Cloudflare Live Input response missing RTMPS credentials");
  }

  return result;
}

export async function getLiveInput(inputId: string): Promise<CloudflareLiveInput> {
  return streamApi<CloudflareLiveInput>(`/live_inputs/${inputId}`, { method: "GET" });
}

export async function updateLiveInput(inputId: string, body: Record<string, unknown>): Promise<CloudflareLiveInput> {
  return streamApi<CloudflareLiveInput>(`/live_inputs/${inputId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function disableLiveInput(inputId: string): Promise<void> {
  await updateLiveInput(inputId, { enabled: false });
}


````

### `supabase/functions/_shared/streamKeyCrypto.ts`

````ts
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function encryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("STREAM_KEY_ENCRYPTION_SECRET") ?? "";
  if (!secret || secret.length < 32) {
    throw new Error("STREAM_KEY_ENCRYPTION_SECRET must be configured with at least 32 characters");
  }
  const hash = await crypto.subtle.digest("SHA-256", ENCODER.encode(secret));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptStreamKey(streamKey: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, ENCODER.encode(streamKey));
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptStreamKey(encrypted: string): Promise<string> {
  const [version, ivPart, dataPart] = encrypted.split(".");
  if (version !== "v1" || !ivPart || !dataPart) throw new Error("Invalid encrypted stream key");
  const key = await encryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(dataPart),
  );
  return DECODER.decode(decrypted);
}

export function maskStreamKey(value?: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢";
  return `${value.slice(0, 4)}â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢${value.slice(-4)}`;
}


````

### `supabase/functions/live-rtmp/index.ts`

````ts
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildStreamPlaybackUrls,
  createLiveInput,
  disableLiveInput,
  getLiveInput,
} from "../_shared/cloudflareStreamService.ts";
import { decryptStreamKey, encryptStreamKey, maskStreamKey } from "../_shared/streamKeyCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SupabaseAdmin = ReturnType<typeof createClient>;
type RtmpStatus = "idle" | "waiting" | "live" | "ended";

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
    recording_status: row.recording_status ?? null,
    archive_status: row.archive_status ?? null,
  };
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
      const playback = buildStreamPlaybackUrls(liveInput.uid).hls;
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
        const liveInput = await getLiveInput(row.cloudflare_live_input_id);
        const status = String(liveInput.status || "").toLowerCase();
        if (["connected", "reconnected", "live"].includes(status)) {
          const now = new Date().toISOString();
          await admin
            .from("live_sessions")
            .update({
              status: "live",
              rtmp_status: "live",
              started_at: row.started_at ?? now,
              rtmp_started_at: row.rtmp_started_at ?? now,
              recording_status: "recording",
              updated_at: now,
            })
            .eq("id", sessionId);
          row.status = "live";
          row.rtmp_status = "live";
          row.recording_status = "recording";
        }
      }
      return json(toResponse(row, { streamKey, reveal: false }));
    }

    if (action === "regenerate" || action === "reset-stream-key") {
      if (row.status === "live" || row.rtmp_status === "live") return error("Cannot reset stream key while live", 409);
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
      const playback = buildStreamPlaybackUrls(liveInput.uid).hls;
      const now = new Date().toISOString();

      const { data: updated, error: updateError } = await admin
        .from("live_sessions")
        .update({
          cloudflare_live_input_id: liveInput.uid,
          rtmps_url: rtmpsUrl,
          stream_key: null,
          stream_key_encrypted: await encryptStreamKey(nextKey),
          stream_key_last_shown_at: now,
          rtmp_status: "waiting",
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

### `supabase/functions/stream-webhook/index.ts`

````ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { archiveReplayToR2 } from "../_shared/archiveReplay.ts";

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
    const postId = await ensureLivePostForObs(supabase, live, playbackHls);
    await supabase
      .from("live_sessions")
      .update({
        status: "live",
        rtmp_status: "live",
        rtmp_started_at: live.rtmp_started_at ?? now,
        started_at: live.started_at ?? now,
        recording_status: "recording",
        playback_url: playbackHls,
        hls_url: playbackHls,
        hls_playback_url: playbackHls,
        post_id: postId,
        updated_at: now,
      })
      .eq("id", live.id);
    await mergePostMetadata(supabase, postId, {
      live_session_id: live.id,
      live_status: "live",
      replay_status: null,
      archive_status: "pending",
      hls_url: playbackHls,
      hls_playback_url: playbackHls,
      playback_url: playbackHls,
    });
    return true;
  }

  if (isDisconnected) {
    await supabase
      .from("live_sessions")
      .update({
        status: "ended",
        rtmp_status: "ended",
        rtmp_ended_at: live.rtmp_ended_at ?? now,
        ended_at: live.ended_at ?? now,
        recording_status: "processing",
        archive_status: "pending",
        updated_at: now,
      })
      .eq("id", live.id);

    if (live.post_id) {
      await mergePostMetadata(supabase, String(live.post_id), {
        live_session_id: live.id,
        live_status: "ended",
        live_mode: "rtmp_obs",
        mode: "rtmp_obs",
        stream_provider: "cloudflare_stream",
        replay_status: "processing",
        archive_status: "pending",
        ended_at: live.ended_at ?? now,
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
    const webhookSecret = Deno.env.get("CLOUDFLARE_STREAM_WEBHOOK_SECRET") ?? "";

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

    if (payload.readyToStream === true && state === "ready") {
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
        .select("id, post_id")
        .eq("id", updatedReplay.live_session_id)
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
          cloudflare_video_uid: uid,
          recording_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", updatedReplay.live_session_id);

      await archiveReplayToR2({ supabase, replayId: replay.id });
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

### `supabase/functions/_shared/archiveReplay.ts`

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

  const { data: replay, error: replayError } = await query.maybeSingle();
  if (replayError) throw replayError;
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
    .select("id, post_id, host_user_id, owner_id, title, cloudflare_video_uid")
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
      archive_status: "archived",
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
        archive_status: "archived",
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

  let postId = live?.post_id ?? null;
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
      await params.supabase.from("live_sessions").update({ post_id: postId, posted_at: archivedAt }).eq("id", live.id);
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

  await deleteCloudflareStreamUid(uid);
  const streamDeletedAt = nowIso();

  await params.supabase
    .from("live_replays")
    .update({ stream_deleted_at: streamDeletedAt, auto_posted_at: archivedAt, updated_at: streamDeletedAt })
    .eq("id", replay.id);

  if (live?.id) {
    await params.supabase
      .from("live_sessions")
      .update({ stream_deleted_at: streamDeletedAt, auto_posted_at: archivedAt, posted_at: archivedAt, updated_at: streamDeletedAt })
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

### `supabase/functions/archive-replay-to-r2/index.ts`

````ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { archiveReplayToR2 } from "../_shared/archiveReplay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase config" }, 500);

    const cronSecret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("SCHEDULED_FUNCTION_SECRET");
    if (cronSecret) {
      const authToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      const headerToken = req.headers.get("x-cron-secret");
      if (authToken !== cronSecret && headerToken !== cronSecret) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const body = await req.json().catch(() => ({}));
    const replayId = typeof body.replay_id === "string" ? body.replay_id : undefined;
    const liveSessionId = typeof body.live_session_id === "string" ? body.live_session_id : undefined;

    if (!replayId && !liveSessionId) {
      return json({ error: "replay_id or live_session_id required" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const result = await archiveReplayToR2({ supabase, replayId, liveSessionId });
    const status = result.ok
      ? 200
      : result.error === "Replay not found"
        ? 404
        : 500;
    return json(result, status);
  } catch (error) {
    console.error("[archive-replay-to-r2]", error);
    return json({ ok: false, status: "failed", error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

````

### `supabase/functions/retry-archive-replays/index.ts`

````ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { archiveReplayToR2 } from "../_shared/archiveReplay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const cronSecret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("SCHEDULED_FUNCTION_SECRET");
    if (cronSecret) {
      const authToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      const headerToken = req.headers.get("x-cron-secret");
      if (authToken !== cronSecret && headerToken !== cronSecret) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase config" }, 500);

    const body = await req.json().catch(() => ({}));
    const limit = typeof body.limit === "number" && body.limit > 0 ? Math.min(body.limit, 20) : 10;
    const now = new Date().toISOString();

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: replays, error } = await supabase
      .from("live_replays")
      .select("id")
      .in("archive_status", ["pending", "mp4_pending", "failed"])
      .is("stream_deleted_at", null)
      .or(`next_archive_retry_at.is.null,next_archive_retry_at.lte.${now}`)
      .order("updated_at", { ascending: true })
      .limit(limit);

    if (error) throw error;

    const results = [];
    for (const replay of replays ?? []) {
      results.push(await archiveReplayToR2({ supabase, replayId: replay.id }));
    }

    return json({ ok: true, processed: results.length, results });
  } catch (error) {
    console.error("[retry-archive-replays]", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

````

### `supabase/functions/_shared/postVideoDelete.ts`

````ts
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type DeleteTarget = {
  id: string;
  type: "cloudflare_stream" | "r2";
  value: string;
  source?: string;
  status?: "pending" | "deleted" | "failed" | "skipped";
  deleted_at?: string;
  error?: string;
};

export type DeleteMetadata = {
  version: 1;
  post_id: string;
  live_session_ids: string[];
  targets: DeleteTarget[];
  updated_at: string;
};

type CloudflareEnv = {
  streamAccountId?: string;
  streamToken?: string;
  r2AccountId?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2BucketName?: string;
  r2Endpoint?: string;
  r2PublicDomain?: string;
};

const STREAM_UID_RE = /^[a-f0-9]{32}$/i;
const ALLOWED_KEY_BUCKETS = new Set(["avatars", "covers", "posts", "videos", "comment-media"]);
const STREAM_HOST_HINTS = [
  "cloudflarestream.com",
  "videodelivery.net",
  "watch.cloudflarestream.com",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeKey(key: string): string {
  return key.replace(/\\/g, "/").replace(/^\/+/, "");
}

function isValidR2Key(key: string): boolean {
  const clean = sanitizeKey(key);
  if (!clean || clean.includes("..") || clean.includes("//")) return false;
  const bucket = clean.split("/").filter(Boolean)[0];
  return !!bucket && ALLOWED_KEY_BUCKETS.has(bucket);
}

function addUniqueTarget(targets: Map<string, DeleteTarget>, target: Omit<DeleteTarget, "id">) {
  const key = `${target.type}:${target.value}`;
  if (targets.has(key)) return;
  targets.set(key, { ...target, id: key, status: target.status ?? "pending" });
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, out));
    return out;
  }

  if (isRecord(value)) {
    Object.values(value).forEach((item) => collectStrings(item, out));
  }

  return out;
}

export function getCloudflareEnv(): CloudflareEnv {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? undefined;
  return {
    streamAccountId: accountId,
    streamToken:
      Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN") ??
      Deno.env.get("CLOUDFLARE_STREAM_TOKEN") ??
      Deno.env.get("CLOUDFLARE_API_TOKEN") ??
      undefined,
    r2AccountId: Deno.env.get("R2_ACCOUNT_ID") ?? accountId,
    r2AccessKeyId:
      Deno.env.get("R2_ACCESS_KEY_ID") ??
      Deno.env.get("CLOUDFLARE_ACCESS_KEY_ID") ??
      undefined,
    r2SecretAccessKey:
      Deno.env.get("R2_SECRET_ACCESS_KEY") ??
      Deno.env.get("CLOUDFLARE_SECRET_ACCESS_KEY") ??
      undefined,
    r2BucketName:
      Deno.env.get("R2_BUCKET_NAME") ??
      Deno.env.get("CLOUDFLARE_R2_BUCKET_NAME") ??
      undefined,
    r2Endpoint: Deno.env.get("R2_ENDPOINT") ?? undefined,
    r2PublicDomain:
      Deno.env.get("R2_PUBLIC_DOMAIN") ??
      Deno.env.get("CLOUDFLARE_R2_PUBLIC_URL") ??
      undefined,
  };
}

export function extractStreamUid(value: string): string | null {
  const trimmed = value.trim();
  if (STREAM_UID_RE.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (!STREAM_HOST_HINTS.some((host) => url.hostname.includes(host))) return null;
    const candidate = url.pathname.split("/").filter(Boolean).find((part) => STREAM_UID_RE.test(part));
    return candidate ?? null;
  } catch {
    return null;
  }
}

export function extractR2Key(value: string, env = getCloudflareEnv()): string | null {
  const trimmed = sanitizeKey(value.trim());
  if (isValidR2Key(trimmed)) return trimmed;

  try {
    const url = new URL(value);
    const publicDomain = env.r2PublicDomain
      ? env.r2PublicDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")
      : null;
    const hostMatchesPublicDomain = publicDomain && url.hostname === publicDomain;
    const hostLooksLikeR2 =
      url.hostname.includes(".r2.cloudflarestorage.com") ||
      url.hostname.includes(".r2.dev") ||
      !!hostMatchesPublicDomain;

    if (!hostLooksLikeR2) return null;

    const pathParts = url.pathname.split("/").filter(Boolean);
    if (pathParts.length === 0) return null;

    const bucketName = env.r2BucketName;
    const keyParts = bucketName && pathParts[0] === bucketName ? pathParts.slice(1) : pathParts;
    const key = sanitizeKey(decodeURIComponent(keyParts.join("/")));
    return isValidR2Key(key) ? key : null;
  } catch {
    return null;
  }
}

export async function buildDeleteMetadata(params: {
  supabase: SupabaseClient;
  post: Record<string, unknown>;
}): Promise<DeleteMetadata> {
  const targets = new Map<string, DeleteTarget>();
  const liveSessionIds = new Set<string>();
  const env = getCloudflareEnv();
  const metadata = isRecord(params.post.metadata) ? params.post.metadata : {};

  const directStreamKeys = [
    "cloudflare_video_uid",
    "cloudflare_stream_uid",
    "stream_video_id",
    "stream_uid",
  ];

  for (const key of directStreamKeys) {
    const uid = asString(metadata[key]);
    if (uid && STREAM_UID_RE.test(uid)) {
      addUniqueTarget(targets, {
        type: "cloudflare_stream",
        value: uid,
        source: `posts.metadata.${key}`,
      });
    }
  }

  const directR2Keys = ["r2_object_key", "r2_key", "source_webm_key"];
  for (const key of directR2Keys) {
    const r2Key = asString(metadata[key]);
    if (r2Key) {
      const cleanKey = extractR2Key(r2Key, env);
      if (cleanKey) {
        addUniqueTarget(targets, {
          type: "r2",
          value: cleanKey,
          source: `posts.metadata.${key}`,
        });
      }
    }
  }

  const sessionId = asString(metadata.live_session_id);
  if (sessionId) liveSessionIds.add(sessionId);

  const strings = [
    ...collectStrings(params.post.video_url),
    ...collectStrings(params.post.media_urls),
    ...collectStrings(metadata),
  ];

  for (const value of strings) {
    const streamUid = extractStreamUid(value);
    if (streamUid) {
      addUniqueTarget(targets, {
        type: "cloudflare_stream",
        value: streamUid,
        source: "posts.url_or_metadata",
      });
    }

    const r2Key = extractR2Key(value, env);
    if (r2Key) {
      addUniqueTarget(targets, {
        type: "r2",
        value: r2Key,
        source: "posts.url_or_metadata",
      });
    }
  }

  const postId = asString(params.post.id);
  if (postId) {
    const { data: sessions } = await params.supabase
      .from("live_sessions")
      .select("id, cloudflare_video_uid")
      .eq("post_id", postId);

    for (const session of sessions ?? []) {
      if (session.id) liveSessionIds.add(session.id);
      if (session.cloudflare_video_uid) {
        addUniqueTarget(targets, {
          type: "cloudflare_stream",
          value: session.cloudflare_video_uid,
          source: "live_sessions.cloudflare_video_uid",
        });
      }
    }
  }

  if (liveSessionIds.size > 0) {
    const ids = [...liveSessionIds];

    const { data: replays } = await params.supabase
      .from("live_replays")
      .select("live_session_id, stream_uid, source_webm_key, playback_hls, playback_dash, playback_mp4, r2_object_key, r2_video_url")
      .in("live_session_id", ids);

    for (const replay of replays ?? []) {
      if (replay.stream_uid) {
        addUniqueTarget(targets, {
          type: "cloudflare_stream",
          value: replay.stream_uid,
          source: "live_replays.stream_uid",
        });
      }

      for (const value of collectStrings(replay)) {
        const r2Key = extractR2Key(value, env);
        if (r2Key) {
          addUniqueTarget(targets, {
            type: "r2",
            value: r2Key,
            source: "live_replays",
          });
        }
      }
    }

    const { data: recordings } = await params.supabase
      .from("live_recordings")
      .select("live_id, media_url, file_list_json")
      .in("live_id", ids);

    for (const recording of recordings ?? []) {
      for (const value of collectStrings(recording)) {
        const streamUid = extractStreamUid(value);
        if (streamUid) {
          addUniqueTarget(targets, {
            type: "cloudflare_stream",
            value: streamUid,
            source: "live_recordings",
          });
        }

        const r2Key = extractR2Key(value, env);
        if (r2Key) {
          addUniqueTarget(targets, {
            type: "r2",
            value: r2Key,
            source: "live_recordings",
          });
        }
      }
    }
  }

  return {
    version: 1,
    post_id: String(params.post.id),
    live_session_ids: [...liveSessionIds],
    targets: [...targets.values()],
    updated_at: nowIso(),
  };
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

async function getSignatureKey(
  key: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode("AWS4" + key).buffer, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createPresignedUrlForDelete(params: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  key: string;
  endpoint?: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const expiresIn = params.expiresInSeconds ?? 300;
  const region = "auto";
  const service = "s3";
  const endpoint = (params.endpoint ?? `https://${params.accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
  const host = new URL(endpoint).host;
  const cleanKey = sanitizeKey(params.key);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const canonicalUri = `/${params.bucketName}/${cleanKey}`;
  const signedHeaders = "host";
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${params.accessKeyId}/${credentialScope}`;

  const queryParams = new URLSearchParams({
    "X-Amz-Algorithm": algorithm,
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": expiresIn.toString(),
    "X-Amz-SignedHeaders": signedHeaders,
  });
  queryParams.sort();

  const canonicalRequest = [
    "DELETE",
    canonicalUri,
    queryParams.toString(),
    `host:${host}\n`,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const canonicalRequestHash = toHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalRequest)),
  );

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  const signingKey = await getSignatureKey(params.secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));
  queryParams.append("X-Amz-Signature", signature);

  return `${endpoint}${canonicalUri}?${queryParams.toString()}`;
}

export async function deleteCloudflareStreamUid(uid: string, env = getCloudflareEnv()): Promise<void> {
  if (!env.streamAccountId || !env.streamToken) {
    throw new Error("Missing Cloudflare Stream configuration");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.streamAccountId}/stream/${uid}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${env.streamToken}` },
    },
  );

  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => "");
    throw new Error(`Cloudflare Stream delete failed: ${response.status} ${body.slice(0, 300)}`);
  }
}

export async function deleteR2Object(key: string, env = getCloudflareEnv()): Promise<void> {
  if (!env.r2AccountId || !env.r2AccessKeyId || !env.r2SecretAccessKey || !env.r2BucketName) {
    throw new Error("Missing Cloudflare R2 configuration");
  }

  const cleanKey = sanitizeKey(key);
  if (!isValidR2Key(cleanKey)) {
    throw new Error("Invalid R2 key");
  }

  const deleteUrl = await createPresignedUrlForDelete({
    accountId: env.r2AccountId,
    accessKeyId: env.r2AccessKeyId,
    secretAccessKey: env.r2SecretAccessKey,
    bucketName: env.r2BucketName,
    key: cleanKey,
    endpoint: env.r2Endpoint,
  });

  const response = await fetch(deleteUrl, { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => "");
    if (!body.includes("NoSuchKey")) {
      throw new Error(`R2 delete failed: ${response.status} ${response.statusText} ${body.slice(0, 300)}`);
    }
  }
}

export async function processDeleteTargets(targets: DeleteTarget[]): Promise<DeleteTarget[]> {
  const processed: DeleteTarget[] = [];

  for (const target of targets) {
    if (target.status === "deleted" && target.deleted_at) {
      processed.push(target);
      continue;
    }

    try {
      if (target.type === "cloudflare_stream") {
        await deleteCloudflareStreamUid(target.value);
      } else {
        await deleteR2Object(target.value);
      }

      processed.push({
        ...target,
        status: "deleted",
        deleted_at: target.deleted_at ?? nowIso(),
        error: undefined,
      });
    } catch (error) {
      processed.push({
        ...target,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return processed;
}

export function summarizeTargets(targets: DeleteTarget[]) {
  const failed = targets.filter((target) => target.status === "failed");
  const deleted = targets.filter((target) => target.status === "deleted");
  const hasStream = targets.some((target) => target.type === "cloudflare_stream");
  const hasR2 = targets.some((target) => target.type === "r2");
  const streamDone = !targets.some((target) => target.type === "cloudflare_stream" && target.status !== "deleted");
  const r2Done = !targets.some((target) => target.type === "r2" && target.status !== "deleted");

  return {
    allDone: failed.length === 0,
    failed,
    deleted,
    hasStream,
    hasR2,
    streamDone,
    r2Done,
    error: failed.map((target) => `${target.type}:${target.value}: ${target.error ?? "failed"}`).join("; "),
  };
}

export function updateDeleteMetadata(metadata: DeleteMetadata, targets: DeleteTarget[]): DeleteMetadata {
  return {
    ...metadata,
    targets,
    updated_at: nowIso(),
  };
}

````

### `supabase/functions/delete-post/index.ts`

````ts
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildDeleteMetadata,
  processDeleteTargets,
  summarizeTargets,
  updateDeleteMetadata,
} from "../_shared/postVideoDelete.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Missing Supabase function configuration" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: authError } = await userClient.auth.getUser();
  const user = userData.user;
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const postId = typeof body.post_id === "string" ? body.post_id : typeof body.postId === "string" ? body.postId : null;
  if (!postId) return json({ error: "Missing post_id" }, 400);

  const { data: post, error: postError } = await serviceClient
    .from("posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();

  if (postError) return json({ error: postError.message }, 500);
  if (!post) return json({ error: "Post not found" }, 404);

  const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });

  if (roleError) console.warn("[delete-post] has_role failed:", roleError.message);

  if (post.user_id !== user.id && !isAdmin) {
    return json({ error: "Forbidden" }, 403);
  }

  if (post.delete_status === "deleted") {
    return json({ status: "deleted", post_id: postId, already_deleted: true });
  }

  const deleteMetadata = await buildDeleteMetadata({ supabase: serviceClient, post });
  const requestedAt = new Date().toISOString();

  await serviceClient
    .from("posts")
    .update({
      delete_status: "deleting",
      delete_requested_at: post.delete_requested_at ?? requestedAt,
      delete_attempts: (post.delete_attempts ?? 0) + 1,
      delete_metadata: deleteMetadata,
      delete_error: null,
      updated_at: requestedAt,
    })
    .eq("id", postId);

  const processedTargets = await processDeleteTargets(deleteMetadata.targets);
  const summary = summarizeTargets(processedTargets);
  const finalMetadata = updateDeleteMetadata(deleteMetadata, processedTargets);
  const completedAt = new Date().toISOString();
  const finalStatus = summary.allDone ? "deleted" : "delete_pending";

  const updatePayload: Record<string, unknown> = {
    deleted_at: post.deleted_at ?? completedAt,
    delete_status: finalStatus,
    delete_error: summary.allDone ? null : summary.error,
    delete_completed_at: summary.allDone ? completedAt : null,
    delete_metadata: finalMetadata,
    cloudflare_deleted_at: summary.hasStream && summary.streamDone ? completedAt : post.cloudflare_deleted_at,
    r2_deleted_at: summary.hasR2 && summary.r2Done ? completedAt : post.r2_deleted_at,
    updated_at: completedAt,
  };

  const { error: updateError } = await serviceClient.from("posts").update(updatePayload).eq("id", postId);
  if (updateError) return json({ error: updateError.message }, 500);

  if (deleteMetadata.live_session_ids.length > 0) {
    await serviceClient
      .from("live_replays")
      .update({
        status: "deleted",
        deleted_at: summary.allDone ? completedAt : null,
        delete_error: summary.allDone ? null : summary.error,
        updated_at: completedAt,
      })
      .in("live_session_id", deleteMetadata.live_session_ids);

    await serviceClient
      .from("live_recordings")
      .update({
        status: "deleted",
        deleted_at: summary.allDone ? completedAt : null,
        delete_error: summary.allDone ? null : summary.error,
      })
      .in("live_id", deleteMetadata.live_session_ids);

    await serviceClient
      .from("live_sessions")
      .update({
        recording_status: "deleted",
        recording_error: summary.allDone ? null : summary.error,
        updated_at: completedAt,
      })
      .in("id", deleteMetadata.live_session_ids);

    await serviceClient
      .from("creator_library")
      .update({
        status: "deleted",
        deleted_at: summary.allDone ? completedAt : null,
        updated_at: completedAt,
      })
      .in("live_session_id", deleteMetadata.live_session_ids);
  }

  await serviceClient
    .from("creator_library")
    .update({
      status: "deleted",
      deleted_at: summary.allDone ? completedAt : null,
      updated_at: completedAt,
    })
    .eq("post_id", postId);

  return json({
    status: finalStatus,
    post_id: postId,
    deleted: {
      stream: processedTargets.filter((target) => target.type === "cloudflare_stream" && target.status === "deleted").length,
      r2: processedTargets.filter((target) => target.type === "r2" && target.status === "deleted").length,
    },
    pending: processedTargets.filter((target) => target.status === "failed").length,
    errors: summary.failed.map((target) => ({
      type: target.type,
      value: target.value,
      error: target.error,
    })),
  }, summary.allDone ? 200 : 202);
});

````

### `supabase/functions/retry-post-video-deletes/index.ts`

````ts
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  processDeleteTargets,
  summarizeTargets,
  updateDeleteMetadata,
} from "../_shared/postVideoDelete.ts";
import type { DeleteMetadata } from "../_shared/postVideoDelete.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const cronSecret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("SCHEDULED_FUNCTION_SECRET");
  if (cronSecret) {
    const authToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const headerToken = req.headers.get("x-cron-secret");
    if (authToken !== cronSecret && headerToken !== cronSecret) {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing Supabase function configuration" }, 500);
  }

  const body = await req.json().catch(() => ({}));
  const limit = typeof body.limit === "number" && body.limit > 0 ? Math.min(body.limit, 50) : 20;
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: posts, error } = await serviceClient
    .from("posts")
    .select("id, delete_attempts, delete_metadata, cloudflare_deleted_at, r2_deleted_at")
    .eq("delete_status", "delete_pending")
    .not("deleted_at", "is", null)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) return json({ error: error.message }, 500);

  const results: Array<Record<string, unknown>> = [];

  for (const post of posts ?? []) {
    const metadata = post.delete_metadata as DeleteMetadata | null;
    if (!metadata?.targets?.length) {
      results.push({ post_id: post.id, status: "skipped", reason: "missing delete metadata" });
      continue;
    }

    const startedAt = new Date().toISOString();
    await serviceClient
      .from("posts")
      .update({
        delete_status: "deleting",
        delete_attempts: (post.delete_attempts ?? 0) + 1,
        updated_at: startedAt,
      })
      .eq("id", post.id);

    const processedTargets = await processDeleteTargets(metadata.targets);
    const summary = summarizeTargets(processedTargets);
    const finalMetadata = updateDeleteMetadata(metadata, processedTargets);
    const completedAt = new Date().toISOString();
    const finalStatus = summary.allDone ? "deleted" : "delete_pending";

    await serviceClient
      .from("posts")
      .update({
        delete_status: finalStatus,
        delete_error: summary.allDone ? null : summary.error,
        delete_completed_at: summary.allDone ? completedAt : null,
        delete_metadata: finalMetadata,
        cloudflare_deleted_at: summary.hasStream && summary.streamDone ? completedAt : post.cloudflare_deleted_at,
        r2_deleted_at: summary.hasR2 && summary.r2Done ? completedAt : post.r2_deleted_at,
        updated_at: completedAt,
      })
      .eq("id", post.id);

    if (metadata.live_session_ids.length > 0) {
      await serviceClient
        .from("live_replays")
        .update({
          status: "deleted",
          deleted_at: summary.allDone ? completedAt : null,
          delete_error: summary.allDone ? null : summary.error,
          updated_at: completedAt,
        })
        .in("live_session_id", metadata.live_session_ids);

      await serviceClient
        .from("live_recordings")
        .update({
          status: "deleted",
          deleted_at: summary.allDone ? completedAt : null,
          delete_error: summary.allDone ? null : summary.error,
        })
        .in("live_id", metadata.live_session_ids);

      await serviceClient
        .from("live_sessions")
        .update({
          recording_status: "deleted",
          recording_error: summary.allDone ? null : summary.error,
          updated_at: completedAt,
        })
        .in("id", metadata.live_session_ids);

      await serviceClient
        .from("creator_library")
        .update({
          status: "deleted",
          deleted_at: summary.allDone ? completedAt : null,
          updated_at: completedAt,
        })
        .in("live_session_id", metadata.live_session_ids);
    }

    await serviceClient
      .from("creator_library")
      .update({
        status: "deleted",
        deleted_at: summary.allDone ? completedAt : null,
        updated_at: completedAt,
      })
      .eq("post_id", post.id);

    results.push({
      post_id: post.id,
      status: finalStatus,
      pending: summary.failed.length,
    });
  }

  return json({ processed: results.length, results });
});

````

### `src/modules/live/rtmpService.ts`

````ts
import { supabase } from '@/integrations/supabase/client';
import type { RtmpStatus } from './types';

type RtmpLiveResponse = {
  live_session_id: string;
  stream_key: string | null;
  rtmp_url: string | null;
  rtmps_url?: string | null;
  hls_url: string;
  status: RtmpStatus;
  app_status?: 'waiting_for_obs' | 'live' | 'ended';
  live_mode?: 'rtmp' | 'rtmp_obs';
  mode?: 'rtmp_obs';
  stream_provider?: 'nginx_rtmp' | 'cloudflare_stream';
  cloudflare_live_input_id?: string | null;
  recording_status?: string | null;
  archive_status?: string | null;
};

export type RtmpLiveStatus = {
  live_session_id: string;
  stream_key?: string | null;
  status: RtmpStatus;
  hls_url: string | null;
  app_status: 'waiting_for_obs' | 'live' | 'ended';
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

### `src/modules/live/pages/RtmpHostPage.tsx`

````tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Clipboard, Home, KeyRound, Loader2, PhoneOff, Radio, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LiveChatPanel } from '../components/LiveChatPanel';
import { RTMPPlayer } from '../components/RTMPPlayer';
import {
  createRtmpLiveSession,
  endRtmpLiveSession,
  getRtmpLiveSession,
  getRtmpLiveStatus,
  getRtmpStreamKeyForCopy,
  regenerateRtmpStreamKey,
  type RtmpLiveStatus,
} from '../rtmpService';

type LoadState = 'loading' | 'ready' | 'error';
type AppStatus = 'waiting_for_obs' | 'live' | 'ended';

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
      toast.error(getErrorMessage(err, 'Khong the copy.'));
    } finally {
      setCopying(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} disabled={copying || (!value && !onCopyValue)} className="shrink-0">
      {copying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : copied ? <Check className="h-4 w-4 mr-2" /> : <Clipboard className="h-4 w-4 mr-2" />}
      {copying ? 'Copying...' : copied ? 'Copied' : label}
    </Button>
  );
}

function statusLabel(status: AppStatus, rtmpStatus: RtmpLiveStatus['status'], archiveStatus?: string | null) {
  if (status === 'live' || rtmpStatus === 'live') return 'LIVE';
  if (status === 'ended' && archiveStatus === 'archived') return 'REPLAY POSTED';
  if (status === 'ended') return 'PROCESSING REPLAY';
  return 'WAITING FOR OBS';
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
  const [appStatus, setAppStatus] = useState<AppStatus>('waiting_for_obs');
  const [recordingStatus, setRecordingStatus] = useState<string | null>(null);
  const [archiveStatus, setArchiveStatus] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const applyLivePayload = useCallback((live: {
    live_session_id: string;
    stream_key?: string | null;
    rtmp_url?: string | null;
    rtmps_url?: string | null;
    hls_url?: string | null;
    playback_url?: string | null;
    status?: RtmpLiveStatus['status'];
    app_status?: AppStatus;
    recording_status?: string | null;
    archive_status?: string | null;
  }) => {
    setSessionId(live.live_session_id);
    if (live.stream_key) setStreamKey(live.stream_key);
    setRtmpsUrl(live.rtmps_url || live.rtmp_url || null);
    setHlsUrl(live.hls_url || live.playback_url || null);
    setRtmpStatus(live.status || 'waiting');
    setAppStatus(live.app_status || (live.status === 'ended' ? 'ended' : live.status === 'live' ? 'live' : 'waiting_for_obs'));
    setRecordingStatus(live.recording_status || null);
    setArchiveStatus(live.archive_status || null);
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!sessionId) return;
    const next = await getRtmpLiveStatus(sessionId);
    setRtmpStatus(next.status);
    setAppStatus(next.app_status || (next.status === 'ended' ? 'ended' : next.status === 'live' ? 'live' : 'waiting_for_obs'));
    if (next.hls_url) setHlsUrl(next.hls_url);
    setRecordingStatus(next.recording_status || null);
    setArchiveStatus(next.archive_status || null);
    if (next.app_status === 'ended' && next.archive_status === 'archived') stopPolling();
  }, [sessionId, stopPolling]);

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
      .channel(`obs-live-host-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as {
            status?: AppStatus;
            rtmp_status?: RtmpLiveStatus['status'];
            hls_url?: string | null;
            playback_url?: string | null;
            recording_status?: string | null;
            archive_status?: string | null;
          };
          setAppStatus(row.status || 'waiting_for_obs');
          setRtmpStatus(row.rtmp_status || 'waiting');
          if (row.hls_url || row.playback_url) setHlsUrl(row.hls_url || row.playback_url || null);
          setRecordingStatus(row.recording_status || null);
          setArchiveStatus(row.archive_status || null);
        },
      )
      .subscribe();

    stopPolling();
    pollTimerRef.current = setInterval(() => {
      refreshStatus().catch(() => undefined);
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      stopPolling();
    };
  }, [refreshStatus, sessionId, stopPolling]);

  const resetKey = async () => {
    if (!sessionId) return;
    try {
      const next = await regenerateRtmpStreamKey(sessionId);
      applyLivePayload(next);
      toast.success('Da tao Stream Key moi.');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Khong the reset Stream Key.'));
    }
  };

  const endLive = async () => {
    if (!sessionId) return;
    try {
      await endRtmpLiveSession(sessionId);
      setAppStatus('ended');
      setRtmpStatus('ended');
      toast.success('Da gui lenh ket thuc livestream. Replay se duoc xu ly tu Cloudflare va luu vao R2.');
      navigate(`/live/${sessionId}`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Khong the ket thuc livestream.'));
    }
  };

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Preparing OBS live...</span>
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
            <div className="font-semibold text-lg">Could not start OBS live</div>
            <div className="text-sm text-muted-foreground">{error}</div>
            <Button variant="outline" onClick={() => navigate('/')}>
              <Home className="h-4 w-4 mr-2" />
              Back home
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const label = statusLabel(appStatus, rtmpStatus, archiveStatus);
  const isLive = appStatus === 'live' || rtmpStatus === 'live';
  const isEnded = appStatus === 'ended';

  return (
    <div className="min-h-screen bg-background">
      <FacebookNavbar />
      <main className="pt-16 px-3 md:px-6 pb-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Live bang OBS</h1>
                <p className="text-sm text-muted-foreground">OBS stream truc tiep len Cloudflare Stream Live Input. Tab nay chi la control panel.</p>
              </div>
              <Badge variant={isLive ? 'destructive' : isEnded ? 'secondary' : 'outline'} className="gap-1">
                <Radio className="h-3.5 w-3.5" />
                {label}
              </Badge>
            </div>

            <Card className="p-4 space-y-4">
              <div className="grid gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Server URL</div>
                  <div className="flex gap-2">
                    <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm break-all">{rtmpsUrl || 'Dang tao RTMPS URL...'}</code>
                    <CopyButton value={rtmpsUrl} label="Copy Server" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Stream Key</div>
                  <div className="flex gap-2">
                    <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm break-all">{streamKey || 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢'}</code>
                    {sessionId && <CopyButton label="Copy Key" onCopyValue={() => getRtmpStreamKeyForCopy(sessionId)} />}
                  </div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground leading-6">
                <div>1. Mo OBS Studio.</div>
                <div>2. Settings {'->'} Stream.</div>
                <div>3. Service {'->'} Custom.</div>
                <div>4. Dan Server URL va Stream Key.</div>
                <div>5. Bam Start Streaming trong OBS. Livestream se tu dong chuyen sang LIVE khi Cloudflare bao connected.</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => refreshStatus().catch((err) => toast.error(getErrorMessage(err, 'Khong the refresh.')))}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" onClick={resetKey} disabled={!sessionId || isLive || isEnded}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Reset Stream Key
                </Button>
                <Button variant="destructive" onClick={endLive} disabled={!sessionId || isEnded}>
                  <PhoneOff className="h-4 w-4 mr-2" />
                  Ket thuc livestream
                </Button>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="aspect-video bg-black">
                <RTMPPlayer
                  src={isLive ? hlsUrl : null}
                  waitingLabel={isEnded ? 'Replay dang duoc xu ly va luu sang R2.' : 'Dang cho OBS ket noi...'}
                />
              </div>
            </Card>

            <Card className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Live status</div>
                  <div className="font-medium">{label}</div>
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
          </section>

          {sessionId && <LiveChatPanel sessionId={sessionId} className="h-[70vh] lg:h-[calc(100vh-120px)]" />}
        </div>
      </main>
    </div>
  );
}

````

### `src/modules/live/pages/LiveAudiencePage.tsx`

````tsx
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
  const isEnded = session?.status === 'ended';
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
    if (session?.status === 'ended') {
      leave().catch(() => undefined);
    }
  }, [leave, session?.status]);

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

### `src/modules/live/hooks/useLiveReplay.ts`

````ts
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LiveReplayInfo {
  id: string;
  status: string;
  playback_hls: string | null;
  playback_mp4: string | null;
  r2_video_url?: string | null;
  playback_provider?: string | null;
  archive_status?: string | null;
  duration_seconds: number | null;
}

/**
 * Fetch the most recent replay for a given live session.
 * - Polls every 5s while replay status is not "ready"/"failed".
 * - When status is "ready" but `playback_mp4` is missing, polls every 10s
 *   AND triggers `stream-mp4-finalize` once to kick off (or pick up) the
 *   Cloudflare MP4 render.
 */
export function useLiveReplay(liveSessionId: string | undefined, enabled: boolean) {
  const finalizeTriggeredRef = useRef<Set<string>>(new Set());

  const query = useQuery<LiveReplayInfo | null>({
    queryKey: ['live-replay', liveSessionId],
    enabled: !!liveSessionId && enabled,
    queryFn: async () => {
      if (!liveSessionId) return null;
      const { data, error } = await supabase
        .from('live_replays')
        .select('id, status, playback_hls, playback_mp4, r2_video_url, playback_provider, archive_status, duration_seconds')
        .eq('live_session_id', liveSessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn('[useLiveReplay] fetch failed:', error);
        return null;
      }
      return (data as LiveReplayInfo) ?? null;
    },
    refetchInterval: (query) => {
      const data = query.state.data as LiveReplayInfo | null | undefined;
      if (!data) return 5000;
      if (data.status === 'failed') return false;
      if (data.status !== 'ready') return 5000;
      // Status ready but waiting for MP4 â€” poll slower.
      if (data.archive_status !== 'archived' || !data.playback_mp4) return 10000;
      return false;
    },
    staleTime: 0,
  });

  // Trigger MP4 finalize when replay is ready but MP4 not yet stored.
  useEffect(() => {
    const replay = query.data;
    if (!replay || replay.status !== 'ready' || replay.playback_mp4) return;
    if (finalizeTriggeredRef.current.has(replay.id)) return;
    finalizeTriggeredRef.current.add(replay.id);
    supabase.functions
      .invoke('archive-replay-to-r2', { body: { replay_id: replay.id } })
      .catch((err) => console.warn('[useLiveReplay] finalize invoke failed', err));
  }, [query.data]);

  return query;
}

````

### `src/modules/live/liveService.ts`

````ts
import { supabase } from '@/integrations/supabase/client';
import { uploadVideoToR2 } from '@/utils/r2Upload';
import type { CreateLiveSessionInput, LiveSession } from './types';

const db = supabase;

const LIVE_POST_DEFAULT_CONTENT = 'Dang LIVE tren FUN Profile';
const WORKER_URL = import.meta.env.VITE_AGORA_WORKER_URL || 'https://fun-agora-rtc-token.hieu-le-010.workers.dev';

const buildChannelName = (userId: string) => `live_${userId}_${Date.now()}`;

const uuidToNumericUid = (uuid: string) => {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    const char = uuid.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash) || 10001;
};

interface UploadLiveRecordingResult {
  key: string;
  url: string;
}

export type RecordingStatus =
  | 'idle'
  | 'acquiring'
  | 'starting'
  | 'recording'
  | 'stopping'
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'stopped';

export interface FinalizeLiveSessionOptions {
  playbackUrl?: string | null;
  recordingStatus?: RecordingStatus;
}

type LivePostMetadata = {
  live_title?: string | null;
  live_status?: 'live' | 'ended';
  channel_name?: string | null;
  agora_channel?: string | null;
  live_session_id?: string | null;
  viewer_count?: number;
  ended_at?: string | null;
  playback_url?: string | null;
  [key: string]: unknown;
};

type RawLiveSessionRow = {
  id: string;
  host_user_id?: string | null;
  owner_id?: string | null;
  agora_channel?: string | null;
  channel_name: string;
  mode?: string | null;
  source?: string | null;
  live_mode?: string | null;
  stream_provider?: string | null;
  stream_key?: string | null;
  rtmps_url?: string | null;
  playback_url?: string | null;
  cloudflare_live_input_id?: string | null;
  cloudflare_video_uid?: string | null;
  rtmp_status?: string | null;
  rtmp_started_at?: string | null;
  rtmp_ended_at?: string | null;
  hls_url?: string | null;
  hls_playback_url?: string | null;
  agora_uid_host?: number | null;
  recording_uid?: number | null;
  recording_status?: string | null;
  archive_status?: string | null;
  storage_provider?: string | null;
  playback_provider?: string | null;
  r2_video_url?: string | null;
  title?: string | null;
  description?: string | null;
  privacy: string;
  status: string;
  viewer_count?: number | null;
  started_at: string;
  ended_at?: string | null;
  created_at: string;
  updated_at: string;
  post_id?: string | null;
  host_profile?: LiveSession['host_profile'];
};

function ensureWorkerUrl(): string {
  if (!WORKER_URL) {
    throw new Error('VITE_AGORA_WORKER_URL is missing');
  }
  return WORKER_URL.replace(/\/+$/, '');
}

async function mergeLivePostMetadata(postId: string, patch: Partial<LivePostMetadata>): Promise<void> {
  const { data: existingPost } = await db
    .from('posts')
    .select('metadata')
    .eq('id', postId)
    .maybeSingle();

  const existing = (existingPost?.metadata || {}) as LivePostMetadata;

  await db
    .from('posts')
    .update({
      metadata: {
        ...existing,
        ...patch,
      } as never,
    })
    .eq('id', postId);
}

function normalizeLiveSession(row: RawLiveSessionRow): LiveSession {
  return {
    id: row.id,
    host_user_id: row.host_user_id || row.owner_id,
    agora_channel: row.agora_channel || row.channel_name,
    channel_name: row.channel_name,
    mode: (row.mode ?? null) as LiveSession['mode'],
    source: (row.source || 'agora') as LiveSession['source'],
    live_mode: (row.live_mode || (row.source === 'rtmp' ? 'rtmp' : 'webcam')) as LiveSession['live_mode'],
    stream_provider: (row.stream_provider || (row.source === 'rtmp' ? 'nginx_rtmp' : 'agora')) as LiveSession['stream_provider'],
    stream_key: row.stream_key ?? null,
    rtmps_url: row.rtmps_url ?? null,
    playback_url: row.playback_url ?? null,
    cloudflare_live_input_id: row.cloudflare_live_input_id ?? null,
    cloudflare_video_uid: row.cloudflare_video_uid ?? null,
    rtmp_status: (row.rtmp_status ?? null) as LiveSession['rtmp_status'],
    rtmp_started_at: row.rtmp_started_at ?? null,
    rtmp_ended_at: row.rtmp_ended_at ?? null,
    hls_url: row.hls_url ?? null,
    hls_playback_url: row.hls_playback_url ?? null,
    agora_uid_host: row.agora_uid_host ?? null,
    recording_uid: row.recording_uid ?? null,
    recording_status: (row.recording_status ?? null) as LiveSession['recording_status'],
    archive_status: (row.archive_status ?? null) as LiveSession['archive_status'],
    storage_provider: (row.storage_provider ?? null) as LiveSession['storage_provider'],
    playback_provider: (row.playback_provider ?? null) as LiveSession['playback_provider'],
    r2_video_url: row.r2_video_url ?? null,
    title: row.title ?? null,
    description: row.description ?? null,
    privacy: row.privacy as LiveSession['privacy'],
    status: row.status as LiveSession['status'],
    viewer_count: row.viewer_count ?? 0,
    started_at: row.started_at,
    ended_at: row.ended_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    post_id: row.post_id ?? null,
    host_profile: row.host_profile
      ? {
          username: row.host_profile.username ?? null,
          full_name: row.host_profile.full_name ?? null,
          avatar_url: row.host_profile.avatar_url ?? null,
        }
      : null,
  };
}

export async function uploadLiveThumbnail(
  thumbnailBlob: Blob,
  liveSessionId: string
): Promise<string | null> {
  try {
    const path = `live/${liveSessionId}/thumbnail.jpg`;
    const { error } = await supabase.storage
      .from('live-thumbnails')
      .upload(path, thumbnailBlob, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    if (error) {
      console.warn('[liveService] uploadLiveThumbnail error:', error);
      return null;
    }
    const { data } = supabase.storage.from('live-thumbnails').getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.warn('[liveService] uploadLiveThumbnail exception:', err);
    return null;
  }
}

export async function attachLiveReplayToPost(
  sessionId: string,
  playbackUrl: string,
  durationSeconds?: number,
  thumbnailUrl?: string | null
): Promise<void> {
  const { error } = await db.rpc('attach_live_replay_to_post', {
    _session_id: sessionId,
    _playback_url: playbackUrl,
    _duration_seconds: durationSeconds,
    _thumbnail_url: thumbnailUrl,
  });
  if (error) throw error;
}

export async function createLiveSession(input: CreateLiveSessionInput): Promise<LiveSession> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('Ban can dang nhap de bat dau live');
  }

  const userId = session.user.id;
  const hostUid = uuidToNumericUid(userId);
  const title = input.title?.trim() || '';
  const channelName = buildChannelName(userId);
  const visibility = input.privacy === 'friends' ? 'friends' : 'public';

  let postId: string | null = null;

  try {
    const { data: post, error: postError } = await db
      .from('posts')
      .insert({
        user_id: userId,
        content: title || LIVE_POST_DEFAULT_CONTENT,
        visibility,
        post_type: 'live',
        metadata: {
          live_title: title,
          live_status: 'live',
          live_mode: 'webcam',
          stream_provider: 'agora',
          channel_name: channelName,
          agora_channel: channelName,
          viewer_count: 0,
        },
      })
      .select('id')
      .single();

    if (postError) throw postError;
    postId = post.id;

    const { data, error } = await db
      .from('live_sessions')
      .insert({
        host_user_id: userId,
        owner_id: userId,
        channel_name: channelName,
        agora_channel: channelName,
        source: 'agora',
        live_mode: 'webcam',
        stream_provider: 'agora',
        agora_uid_host: hostUid,
        title,
        privacy: input.privacy,
        status: 'live',
        recording_status: 'idle',
        post_id: postId,
      })
      .select(
        `
        id, host_user_id, agora_channel, channel_name, mode, source, live_mode, stream_provider, stream_key,
        rtmps_url, playback_url, cloudflare_live_input_id, cloudflare_video_uid, rtmp_status,
        rtmp_started_at, rtmp_ended_at, hls_url, hls_playback_url, recording_status, archive_status,
        storage_provider, playback_provider, r2_video_url, title, description, privacy, status, viewer_count,
        started_at, ended_at, created_at, updated_at, post_id,
        host_profile:profiles!live_sessions_host_user_id_fkey(username, full_name, avatar_url)
      `
      )
      .single();

    if (error) throw error;

    await db
      .from('posts')
      .update({
        metadata: {
          live_title: title,
          live_status: 'live',
          live_mode: 'webcam',
          stream_provider: 'agora',
          channel_name: channelName,
          agora_channel: channelName,
          live_session_id: data.id,
          viewer_count: 0,
        },
      })
      .eq('id', postId);

    return normalizeLiveSession(data);
  } catch (error) {
    if (postId) {
      await db.from('posts').delete().eq('id', postId);
    }
    throw error;
  }
}

export async function getLiveSession(sessionId: string): Promise<LiveSession | null> {
  const { data, error } = await db
    .from('live_sessions')
    .select(
      `
      id, host_user_id, agora_channel, channel_name, mode, source, live_mode, stream_provider, stream_key,
      rtmps_url, playback_url, cloudflare_live_input_id, cloudflare_video_uid, rtmp_status,
      rtmp_started_at, rtmp_ended_at, hls_url, hls_playback_url, recording_uid, recording_status, archive_status,
      storage_provider, playback_provider, r2_video_url, title, description, privacy, status, viewer_count,
      started_at, ended_at, created_at, updated_at, post_id,
      host_profile:profiles!live_sessions_host_user_id_fkey(username, full_name, avatar_url)
    `
    )
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return normalizeLiveSession(data);
}

export async function listActiveLiveSessions(): Promise<LiveSession[]> {
  const { data, error } = await db
    .from('live_sessions')
    .select(
      `
      id, host_user_id, agora_channel, channel_name, mode, source, live_mode, stream_provider, stream_key,
      rtmps_url, playback_url, cloudflare_live_input_id, cloudflare_video_uid, rtmp_status,
      rtmp_started_at, rtmp_ended_at, hls_url, hls_playback_url, recording_status, archive_status,
      storage_provider, playback_provider, r2_video_url, title, description, privacy, status, viewer_count,
      started_at, ended_at, created_at, updated_at, post_id,
      host_profile:profiles!live_sessions_host_user_id_fkey(username, full_name, avatar_url)
    `
    )
    .eq('status', 'live')
    .order('started_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeLiveSession);
}

export async function endLiveSession(sessionId: string): Promise<void> {
  await finalizeLiveSession(sessionId, { recordingStatus: 'failed' });
}

export async function updateLiveRecordingStatus(
  sessionId: string,
  recordingStatus: RecordingStatus,
  recordingError?: string | null
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await db
    .from('live_sessions')
    .update({
      recording_status: recordingStatus,
      recording_error: recordingError ?? null,
      updated_at: nowIso,
    })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function finalizeLiveSession(
  sessionId: string,
  options: FinalizeLiveSessionOptions = {}
): Promise<void> {
  const { playbackUrl = null, recordingStatus = playbackUrl ? 'ready' : 'failed' } = options;
  const nowIso = new Date().toISOString();

  // Step 1: update only â€” do NOT chain .select() (memory rule)
  const { error: updErr } = await db
    .from('live_sessions')
    .update({
      status: 'ended',
      ended_at: nowIso,
      recording_status: recordingStatus,
      updated_at: nowIso,
    })
    .eq('id', sessionId);

  if (updErr) throw updErr;

  // Step 2: fetch row separately with maybeSingle to handle race conditions
  // (e.g. webhook may have already advanced the row, or row may not exist)
  const { data } = await db
    .from('live_sessions')
    .select('id, post_id, title, agora_channel, channel_name, ended_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (!data) return; // session not found â€” exit gracefully, no error

  if (data.post_id) {
    await mergeLivePostMetadata(data.post_id, {
      live_session_id: data.id,
      live_title: data.title,
      channel_name: data.agora_channel || data.channel_name,
      agora_channel: data.agora_channel || data.channel_name,
      live_status: 'ended',
      live_mode: 'webcam',
      stream_provider: 'agora',
      ended_at: data.ended_at,
      playback_url: playbackUrl,
      replay_status: recordingStatus,
      playback_type: playbackUrl ? 'chunked' : 'cloudflare_stream',
    });

    if (playbackUrl) {
      await db.from('posts')
        .update({ video_url: playbackUrl })
        .eq('id', data.post_id);
    }
  }
}

export async function updateLiveViewerCount(sessionId: string, viewerCount: number): Promise<void> {
  const nextCount = Math.max(0, viewerCount);
  const { data } = await db
    .from('live_sessions')
    .update({ viewer_count: nextCount })
    .eq('id', sessionId)
    .select('id, post_id, title, agora_channel, channel_name')
    .maybeSingle();

  if (data?.post_id) {
    await db
      .from('posts')
      .update({
        metadata: {
          live_title: data.title,
          channel_name: data.agora_channel || data.channel_name,
          agora_channel: data.agora_channel || data.channel_name,
          live_status: 'live',
          live_mode: 'webcam',
          stream_provider: 'agora',
          viewer_count: nextCount,
          live_session_id: data.id,
        },
      })
      .eq('id', data.post_id);
  }
}

export async function incrementLiveViewerCount(sessionId: string): Promise<void> {
  await db.rpc('increment_live_viewer_count', { session_id: sessionId });
}

export async function decrementLiveViewerCount(sessionId: string): Promise<void> {
  await db.rpc('decrement_live_viewer_count', { session_id: sessionId });
}

export async function uploadLiveRecording(
  blob: Blob,
  liveSessionId: string,
  mimeType: string,
  onProgress?: (percent: number) => void
): Promise<UploadLiveRecordingResult> {
  const extension = mimeType.includes('webm') ? 'webm' : 'mp4';
  const filename = `live-${liveSessionId}-${Date.now()}.${extension}`;
  const file = new File([blob], filename, { type: mimeType });

  const result = await uploadVideoToR2(
    file,
    onProgress
      ? (p) => onProgress(p.percentage)
      : undefined
  );

  return { key: result.key, url: result.publicUrl };
}

export async function saveLiveReplay(liveSessionId: string, playbackUrl?: string | null): Promise<void> {
  await finalizeLiveSession(liveSessionId, {
    playbackUrl: playbackUrl || null,
    recordingStatus: playbackUrl ? 'ready' : 'failed',
  });
}

````

### `src/modules/live/types.ts`

````ts
export type LivePrivacy = 'public' | 'friends';
export type LiveStatus = 'waiting_for_obs' | 'live' | 'ended';
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
  mode?: 'agora' | 'rtmp_obs' | null;
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
  archive_status?: 'pending' | 'mp4_pending' | 'archiving' | 'archived' | 'failed' | null;
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

### `src/modules/live/components/StartLiveDialog.tsx`

````tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, RadioTower, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface StartLiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type StartMode = 'webcam' | 'rtmp' | 'record';

export function StartLiveDialog({ open, onOpenChange }: StartLiveDialogProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<StartMode>('webcam');

  const handleStart = () => {
    onOpenChange(false);
    if (mode === 'webcam') navigate('/live/new');
    if (mode === 'rtmp') navigate('/live/rtmp/new');
    if (mode === 'record') navigate('/live/stream');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-destructive" />
            Báº¯t Ä‘áº§u LIVE
          </DialogTitle>
          <DialogDescription>Chá»n cĂ¡ch con muá»‘n phĂ¡t trá»±c tiáº¿p.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup
            value={mode}
            onValueChange={(value) => setMode(value as StartMode)}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <label
              htmlFor="mode-webcam"
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                mode === 'webcam'
                  ? 'border-destructive bg-destructive/5'
                  : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <RadioGroupItem value="webcam" id="mode-webcam" className="sr-only" />
              <Video className="h-6 w-6 text-destructive" />
              <span className="text-sm font-medium">Webcam</span>
              <span className="text-xs text-muted-foreground text-center">PhĂ¡t tá»« camera (Agora RTC)</span>
            </label>

            <label
              htmlFor="mode-rtmp"
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                mode === 'rtmp'
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <RadioGroupItem value="rtmp" id="mode-rtmp" className="sr-only" />
              <RadioTower className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Live báº±ng OBS</span>
              <span className="text-xs text-muted-foreground text-center">PhĂ¡t tá»« pháº§n má»m (OBS, vMix...)</span>
            </label>

            <label
              htmlFor="mode-record"
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                mode === 'record'
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <RadioGroupItem value="record" id="mode-record" className="sr-only" />
              <Film className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Ghi & ÄÄƒng</span>
              <span className="text-xs text-muted-foreground text-center">Quay trĂªn trĂ¬nh duyá»‡t</span>
            </label>
          </RadioGroup>

          <Button onClick={handleStart} className="w-full">
            {mode === 'webcam' ? 'Báº¯t Ä‘áº§u Webcam Live' : mode === 'rtmp' ? 'Live báº±ng OBS' : 'Báº¯t Ä‘áº§u ghi'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

````

### `src/modules/live/components/RTMPPlayer.tsx`

````tsx
import { HlsPlayer } from './HlsPlayer';

interface RTMPPlayerProps {
  src?: string | null;
  title?: string;
  poster?: string;
  className?: string;
  waitingLabel?: string;
}

export function RTMPPlayer({
  src,
  title = 'RTMP live stream',
  poster,
  className,
  waitingLabel = 'Waiting for OBS stream...',
}: RTMPPlayerProps) {
  return (
    <HlsPlayer
      src={src}
      title={title}
      poster={poster}
      className={className}
      waitingLabel={waitingLabel}
      autoPlay
      muted
    />
  );
}

````

### `src/modules/live/components/HlsPlayer.tsx`

````tsx
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2 } from 'lucide-react';

interface HlsPlayerProps {
  src?: string | null;
  title?: string;
  muted?: boolean;
  autoPlay?: boolean;
  poster?: string;
  className?: string;
  waitingLabel?: string;
}

export function HlsPlayer({
  src,
  title = 'Live stream',
  muted = false,
  autoPlay = true,
  poster,
  className = '',
  waitingLabel = 'Waiting for stream...',
}: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<'waiting' | 'loading' | 'ready' | 'buffering' | 'error'>('waiting');

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) {
      setState('waiting');
      return;
    }

    let hls: Hls | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    setState('loading');

    const markReady = () => {
      if (!cancelled) setState('ready');
    };
    const markBuffering = () => {
      if (!cancelled) setState('buffering');
    };
    const markError = () => {
      if (!cancelled) setState('error');
    };

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', markReady);
      video.addEventListener('error', markError);
      video.addEventListener('waiting', markBuffering);
      video.addEventListener('playing', markReady);
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 6,
        backBufferLength: 30,
        manifestLoadingMaxRetry: 6,
        levelLoadingMaxRetry: 6,
        fragLoadingMaxRetry: 6,
      });
      hls.on(Hls.Events.MANIFEST_PARSED, markReady);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) {
          if (data.details?.includes('buffer')) markBuffering();
          return;
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retryCount < 5) {
          retryCount += 1;
          markBuffering();
          retryTimer = setTimeout(() => hls?.startLoad(), Math.min(1000 * retryCount, 5000));
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retryCount < 3) {
          retryCount += 1;
          markBuffering();
          hls?.recoverMediaError();
          return;
        }

        markError();
      });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      markError();
    }

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      video.removeEventListener('loadedmetadata', markReady);
      video.removeEventListener('error', markError);
      video.removeEventListener('waiting', markBuffering);
      video.removeEventListener('playing', markReady);
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [src]);

  return (
    <div className={`relative h-full w-full bg-black ${className}`}>
      <video
        ref={videoRef}
        title={title}
        className="h-full w-full object-contain bg-black"
        controls
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        poster={poster}
      />
      {state !== 'ready' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 px-4 text-center text-white">
          {state === 'loading' || state === 'buffering' ? <Loader2 className="h-6 w-6 animate-spin" /> : null}
          <div className="text-sm font-medium">
            {state === 'error' ? 'Stream preview is not available yet.' : state === 'buffering' ? 'Reconnecting stream...' : waitingLabel}
          </div>
        </div>
      )}
    </div>
  );
}

````

### `src/integrations/supabase/types.ts`

````ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_merge_requests: {
        Row: {
          admin_note: string | null
          auto_provisioned: boolean | null
          created_at: string
          email: string
          id: string
          merge_type: string
          platform_data: Json | null
          provision_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_platform: string
          source_user_id: string | null
          source_username: string | null
          status: string
          target_platform: string
          target_user_id: string | null
          updated_at: string
          webhook_sent: boolean | null
          webhook_sent_at: string | null
        }
        Insert: {
          admin_note?: string | null
          auto_provisioned?: boolean | null
          created_at?: string
          email: string
          id?: string
          merge_type: string
          platform_data?: Json | null
          provision_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_platform: string
          source_user_id?: string | null
          source_username?: string | null
          status?: string
          target_platform?: string
          target_user_id?: string | null
          updated_at?: string
          webhook_sent?: boolean | null
          webhook_sent_at?: string | null
        }
        Update: {
          admin_note?: string | null
          auto_provisioned?: boolean | null
          created_at?: string
          email?: string
          id?: string
          merge_type?: string
          platform_data?: Json | null
          provision_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_platform?: string
          source_user_id?: string | null
          source_username?: string | null
          status?: string
          target_platform?: string
          target_user_id?: string | null
          updated_at?: string
          webhook_sent?: boolean | null
          webhook_sent_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          reason: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          reason?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          reason?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      blacklisted_wallets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_permanent: boolean
          reason: string
          user_id: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_permanent?: boolean
          reason?: string
          user_id?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_permanent?: boolean
          reason?: string
          user_id?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      call_participants: {
        Row: {
          call_session_id: string | null
          created_at: string | null
          id: string
          is_muted: boolean | null
          is_video_off: boolean | null
          joined_at: string | null
          left_at: string | null
          user_id: string
        }
        Insert: {
          call_session_id?: string | null
          created_at?: string | null
          id?: string
          is_muted?: boolean | null
          is_video_off?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          user_id: string
        }
        Update: {
          call_session_id?: string | null
          created_at?: string | null
          id?: string
          is_muted?: boolean | null
          is_video_off?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          call_type: string
          channel_name: string
          conversation_id: string | null
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          initiator_id: string
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          call_type: string
          channel_name: string
          conversation_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          initiator_id: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          call_type?: string
          channel_name?: string
          conversation_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          initiator_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_settings: {
        Row: {
          created_at: string | null
          id: string
          show_read_receipts: boolean | null
          show_typing_indicator: boolean | null
          updated_at: string | null
          user_id: string
          who_can_message: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          show_read_receipts?: boolean | null
          show_typing_indicator?: boolean | null
          updated_at?: string | null
          user_id: string
          who_can_message?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          show_read_receipts?: boolean | null
          show_typing_indicator?: boolean | null
          updated_at?: string | null
          user_id?: string
          who_can_message?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          parent_comment_id: string | null
          post_id: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          parent_comment_id?: string | null
          post_id: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          parent_comment_id?: string | null
          post_id?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string | null
          last_read_at: string | null
          left_at: string | null
          muted_until: string | null
          nickname: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          left_at?: string | null
          muted_until?: string | null
          nickname?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          left_at?: string | null
          muted_until?: string | null
          nickname?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          name: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      creator_library: {
        Row: {
          created_at: string
          deleted_at: string | null
          duration_seconds: number | null
          filesize_bytes: number | null
          id: string
          live_replay_id: string | null
          live_session_id: string | null
          media_type: string
          playback_provider: string
          post_id: string | null
          r2_bucket: string | null
          r2_object_key: string
          source_stream_uid: string | null
          status: string
          storage_provider: string
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
          video_url: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          filesize_bytes?: number | null
          id?: string
          live_replay_id?: string | null
          live_session_id?: string | null
          media_type?: string
          playback_provider?: string
          post_id?: string | null
          r2_bucket?: string | null
          r2_object_key: string
          source_stream_uid?: string | null
          status?: string
          storage_provider?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          video_url: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          filesize_bytes?: number | null
          id?: string
          live_replay_id?: string | null
          live_session_id?: string | null
          media_type?: string
          playback_provider?: string
          post_id?: string | null
          r2_bucket?: string | null
          r2_object_key?: string
          source_stream_uid?: string | null
          status?: string
          storage_provider?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_library_live_replay_id_fkey"
            columns: ["live_replay_id"]
            isOneToOne: false
            referencedRelation: "live_replays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_library_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_library_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_library_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_library_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cross_platform_tokens: {
        Row: {
          access_token: string
          access_token_expires_at: string
          client_id: string
          created_at: string
          device_info: Json | null
          id: string
          is_revoked: boolean
          last_used_at: string | null
          refresh_token: string
          refresh_token_expires_at: string
          scope: string[]
          user_id: string
        }
        Insert: {
          access_token: string
          access_token_expires_at: string
          client_id: string
          created_at?: string
          device_info?: Json | null
          id?: string
          is_revoked?: boolean
          last_used_at?: string | null
          refresh_token: string
          refresh_token_expires_at: string
          scope?: string[]
          user_id: string
        }
        Update: {
          access_token?: string
          access_token_expires_at?: string
          client_id?: string
          created_at?: string
          device_info?: Json | null
          id?: string
          is_revoked?: boolean
          last_used_at?: string | null
          refresh_token?: string
          refresh_token_expires_at?: string
          scope?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cross_platform_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "cross_platform_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_platform_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_gifts: {
        Row: {
          amount_numeric: number
          chain_id: number
          conversation_id: string | null
          created_at: string
          error: string | null
          from_user_id: string
          id: string
          message_id: string | null
          status: string
          to_address: string
          to_user_id: string
          token: string
          tx_hash: string | null
        }
        Insert: {
          amount_numeric: number
          chain_id?: number
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          from_user_id: string
          id?: string
          message_id?: string | null
          status?: string
          to_address: string
          to_user_id: string
          token: string
          tx_hash?: string | null
        }
        Update: {
          amount_numeric?: number
          chain_id?: number
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          from_user_id?: string
          id?: string
          message_id?: string | null
          status?: string
          to_address?: string
          to_user_id?: string
          token?: string
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crypto_gifts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_gifts_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_gifts_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_gifts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_gifts_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_gifts_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custodial_wallets: {
        Row: {
          chain_id: number
          created_at: string
          encrypted_private_key: string
          encryption_version: number
          id: string
          is_active: boolean
          last_activity_at: string | null
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          chain_id?: number
          created_at?: string
          encrypted_private_key: string
          encryption_version?: number
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          chain_id?: number
          created_at?: string
          encrypted_private_key?: string
          encryption_version?: number
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "custodial_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodial_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_link_otps: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          otp_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          otp_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feed_posts: {
        Row: {
          author_id: string | null
          caption: string | null
          created_at: string | null
          id: string
          media_key: string | null
          media_url: string | null
          recording_id: string | null
          source: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          author_id?: string | null
          caption?: string | null
          created_at?: string | null
          id?: string
          media_key?: string | null
          media_url?: string | null
          recording_id?: string | null
          source?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          author_id?: string | null
          caption?: string | null
          created_at?: string | null
          id?: string
          media_key?: string | null
          media_url?: string | null
          recording_id?: string | null
          source?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "live_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          action: string
          amount: number
          client_id: string
          created_at: string
          currency: string
          id: string
          metadata: Json | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          action: string
          amount: number
          client_id: string
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          transaction_id: string
          user_id: string
        }
        Update: {
          action?: string
          amount?: number
          client_id?: string
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      live_comments: {
        Row: {
          created_at: string
          id: string
          live_session_id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          live_session_id: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          live_session_id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_comments_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_messages: {
        Row: {
          content: string
          created_at: string
          id: number
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: never
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: never
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: number
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: never
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: never
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_reactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_recordings: {
        Row: {
          created_at: string | null
          delete_error: string | null
          deleted_at: string | null
          duration_seconds: number | null
          file_list_json: Json | null
          id: string
          live_id: string | null
          media_url: string | null
          mode: string | null
          raw_response: Json | null
          recorder_uid: string | null
          resource_id: string | null
          sid: string | null
          status: string | null
          stopped_at: string | null
          storage_region: number | null
          storage_vendor: number | null
          thumbnail_url: string | null
        }
        Insert: {
          created_at?: string | null
          delete_error?: string | null
          deleted_at?: string | null
          duration_seconds?: number | null
          file_list_json?: Json | null
          id?: string
          live_id?: string | null
          media_url?: string | null
          mode?: string | null
          raw_response?: Json | null
          recorder_uid?: string | null
          resource_id?: string | null
          sid?: string | null
          status?: string | null
          stopped_at?: string | null
          storage_region?: number | null
          storage_vendor?: number | null
          thumbnail_url?: string | null
        }
        Update: {
          created_at?: string | null
          delete_error?: string | null
          deleted_at?: string | null
          duration_seconds?: number | null
          file_list_json?: Json | null
          id?: string
          live_id?: string | null
          media_url?: string | null
          mode?: string | null
          raw_response?: Json | null
          recorder_uid?: string | null
          resource_id?: string | null
          sid?: string | null
          status?: string | null
          stopped_at?: string | null
          storage_region?: number | null
          storage_vendor?: number | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_recordings_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_replays: {
        Row: {
          archive_attempts: number
          archive_error: string | null
          archive_status: string
          archived_at: string | null
          auto_posted_at: string | null
          chunked_recording_id: string | null
          cloudflare_mp4_download_url: string | null
          cloudflare_playback_url: string | null
          created_at: string
          delete_error: string | null
          deleted_at: string | null
          duration_seconds: number | null
          error_message: string | null
          filesize_bytes: number | null
          id: string
          live_session_id: string
          next_archive_retry_at: string | null
          playback_dash: string | null
          playback_hls: string | null
          playback_mp4: string | null
          playback_provider: string
          processing_started_at: string | null
          r2_bucket: string | null
          r2_object_key: string | null
          r2_video_url: string | null
          source_webm_key: string | null
          status: string
          storage_provider: string
          stream_deleted_at: string | null
          stream_uid: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archive_attempts?: number
          archive_error?: string | null
          archive_status?: string
          archived_at?: string | null
          auto_posted_at?: string | null
          chunked_recording_id?: string | null
          cloudflare_mp4_download_url?: string | null
          cloudflare_playback_url?: string | null
          created_at?: string
          delete_error?: string | null
          deleted_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          filesize_bytes?: number | null
          id?: string
          live_session_id: string
          next_archive_retry_at?: string | null
          playback_dash?: string | null
          playback_hls?: string | null
          playback_mp4?: string | null
          playback_provider?: string
          processing_started_at?: string | null
          r2_bucket?: string | null
          r2_object_key?: string | null
          r2_video_url?: string | null
          source_webm_key?: string | null
          status?: string
          storage_provider?: string
          stream_deleted_at?: string | null
          stream_uid: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archive_attempts?: number
          archive_error?: string | null
          archive_status?: string
          archived_at?: string | null
          auto_posted_at?: string | null
          chunked_recording_id?: string | null
          cloudflare_mp4_download_url?: string | null
          cloudflare_playback_url?: string | null
          created_at?: string
          delete_error?: string | null
          deleted_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          filesize_bytes?: number | null
          id?: string
          live_session_id?: string
          next_archive_retry_at?: string | null
          playback_dash?: string | null
          playback_hls?: string | null
          playback_mp4?: string | null
          playback_provider?: string
          processing_started_at?: string | null
          r2_bucket?: string | null
          r2_object_key?: string | null
          r2_video_url?: string | null
          source_webm_key?: string | null
          status?: string
          storage_provider?: string
          stream_deleted_at?: string | null
          stream_uid?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      live_sessions: {
        Row: {
          agora_channel: string | null
          agora_uid_host: number | null
          archive_error: string | null
          archive_status: string
          archived_at: string | null
          auto_posted_at: string | null
          channel_name: string
          cloudflare_live_input_id: string | null
          cloudflare_mp4_download_url: string | null
          cloudflare_playback_url: string | null
          cloudflare_video_uid: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          ended_at: string | null
          hls_playback_url: string | null
          hls_url: string | null
          host_user_id: string
          id: string
          last_worker_response: Json | null
          live_mode: string
          mode: string | null
          owner_id: string | null
          playback_url: string | null
          playback_provider: string | null
          posted_at: string | null
          post_id: string | null
          privacy: string
          processing_started_at: string | null
          r2_bucket: string | null
          r2_object_key: string | null
          r2_video_url: string | null
          recording_acquired_at: string | null
          recording_error: string | null
          recording_ready_at: string | null
          recording_started_at: string | null
          recording_status: string | null
          recording_stopped_at: string | null
          recording_uid: number | null
          resource_id: string | null
          rtmp_ended_at: string | null
          rtmps_url: string | null
          rtmp_started_at: string | null
          rtmp_status: string | null
          sid: string | null
          source: string | null
          started_at: string
          status: string
          storage_provider: string | null
          stream_deleted_at: string | null
          stream_key: string | null
          stream_key_encrypted: string | null
          stream_key_last_shown_at: string | null
          stream_provider: string
          title: string
          updated_at: string
          viewer_count: number
        }
        Insert: {
          agora_channel?: string | null
          agora_uid_host?: number | null
          archive_error?: string | null
          archive_status?: string
          archived_at?: string | null
          auto_posted_at?: string | null
          channel_name: string
          cloudflare_live_input_id?: string | null
          cloudflare_mp4_download_url?: string | null
          cloudflare_playback_url?: string | null
          cloudflare_video_uid?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          ended_at?: string | null
          hls_playback_url?: string | null
          hls_url?: string | null
          host_user_id: string
          id?: string
          last_worker_response?: Json | null
          live_mode?: string
          mode?: string | null
          owner_id?: string | null
          playback_url?: string | null
          playback_provider?: string | null
          posted_at?: string | null
          post_id?: string | null
          privacy?: string
          processing_started_at?: string | null
          r2_bucket?: string | null
          r2_object_key?: string | null
          r2_video_url?: string | null
          recording_acquired_at?: string | null
          recording_error?: string | null
          recording_ready_at?: string | null
          recording_started_at?: string | null
          recording_status?: string | null
          recording_stopped_at?: string | null
          recording_uid?: number | null
          resource_id?: string | null
          rtmp_ended_at?: string | null
          rtmps_url?: string | null
          rtmp_started_at?: string | null
          rtmp_status?: string | null
          sid?: string | null
          source?: string | null
          started_at?: string
          status?: string
          storage_provider?: string | null
          stream_deleted_at?: string | null
          stream_key?: string | null
          stream_key_encrypted?: string | null
          stream_key_last_shown_at?: string | null
          stream_provider?: string
          title?: string
          updated_at?: string
          viewer_count?: number
        }
        Update: {
          agora_channel?: string | null
          agora_uid_host?: number | null
          archive_error?: string | null
          archive_status?: string
          archived_at?: string | null
          auto_posted_at?: string | null
          channel_name?: string
          cloudflare_live_input_id?: string | null
          cloudflare_mp4_download_url?: string | null
          cloudflare_playback_url?: string | null
          cloudflare_video_uid?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          ended_at?: string | null
          hls_playback_url?: string | null
          hls_url?: string | null
          host_user_id?: string
          id?: string
          last_worker_response?: Json | null
          live_mode?: string
          mode?: string | null
          owner_id?: string | null
          playback_url?: string | null
          playback_provider?: string | null
          posted_at?: string | null
          post_id?: string | null
          privacy?: string
          processing_started_at?: string | null
          r2_bucket?: string | null
          r2_object_key?: string | null
          r2_video_url?: string | null
          recording_acquired_at?: string | null
          recording_error?: string | null
          recording_ready_at?: string | null
          recording_started_at?: string | null
          recording_status?: string | null
          recording_stopped_at?: string | null
          recording_uid?: number | null
          resource_id?: string | null
          rtmp_ended_at?: string | null
          rtmps_url?: string | null
          rtmp_started_at?: string | null
          rtmp_status?: string | null
          sid?: string | null
          source?: string | null
          started_at?: string
          status?: string
          storage_provider?: string | null
          stream_deleted_at?: string | null
          stream_key?: string | null
          stream_key_encrypted?: string | null
          stream_key_last_shown_at?: string | null
          stream_provider?: string
          title?: string
          updated_at?: string
          viewer_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      livestreams: {
        Row: {
          created_at: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          is_eligible: boolean | null
          started_at: string
          stream_id: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          is_eligible?: boolean | null
          started_at?: string
          stream_id?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          is_eligible?: boolean | null
          started_at?: string
          stream_id?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "livestreams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livestreams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          id: string
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_deleted: boolean | null
          media_urls: Json | null
          message_type: string
          metadata: Json
          pinned_at: string | null
          pinned_by: string | null
          reply_to_id: string | null
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          media_urls?: Json | null
          message_type?: string
          metadata?: Json
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          media_urls?: Json | null
          message_type?: string
          metadata?: Json
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          post_id: string | null
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_clients: {
        Row: {
          allowed_scopes: string[]
          client_id: string
          client_name: string
          client_secret: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          platform_name: string | null
          redirect_uris: string[]
          updated_at: string
          webhook_url: string | null
          website_url: string | null
        }
        Insert: {
          allowed_scopes?: string[]
          client_id: string
          client_name: string
          client_secret: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          platform_name?: string | null
          redirect_uris?: string[]
          updated_at?: string
          webhook_url?: string | null
          website_url?: string | null
        }
        Update: {
          allowed_scopes?: string[]
          client_id?: string
          client_name?: string
          client_secret?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          platform_name?: string | null
          redirect_uris?: string[]
          updated_at?: string
          webhook_url?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      oauth_codes: {
        Row: {
          client_id: string
          code: string
          code_challenge: string | null
          code_challenge_method: string | null
          created_at: string
          expires_at: string
          id: string
          is_used: boolean
          redirect_uri: string
          scope: string[]
          user_id: string
        }
        Insert: {
          client_id: string
          code: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          redirect_uri: string
          scope?: string[]
          user_id: string
        }
        Update: {
          client_id?: string
          code?: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          redirect_uri?: string
          scope?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "oauth_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          identifier: string
          is_used: boolean
          max_attempts: number
          type: string
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at: string
          id?: string
          identifier: string
          is_used?: boolean
          max_attempts?: number
          type?: string
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          identifier?: string
          is_used?: boolean
          max_attempts?: number
          type?: string
        }
        Relationships: []
      }
      pending_provisions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          email: string
          fun_profile_id: string | null
          id: string
          merge_request_id: string | null
          password_token_hash: string
          platform_data: Json | null
          platform_id: string
          platform_user_id: string | null
          status: string | null
          token_expires_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          email: string
          fun_profile_id?: string | null
          id?: string
          merge_request_id?: string | null
          password_token_hash: string
          platform_data?: Json | null
          platform_id: string
          platform_user_id?: string | null
          status?: string | null
          token_expires_at: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          email?: string
          fun_profile_id?: string | null
          id?: string
          merge_request_id?: string | null
          password_token_hash?: string
          platform_data?: Json | null
          platform_id?: string
          platform_user_id?: string | null
          status?: string | null
          token_expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_provisions_merge_request_id_fkey"
            columns: ["merge_request_id"]
            isOneToOne: false
            referencedRelation: "account_merge_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_financial_data: {
        Row: {
          client_id: string
          client_timestamp: string | null
          created_at: string
          id: string
          last_sync_at: string
          sync_count: number
          total_bet: number
          total_deposit: number
          total_loss: number
          total_profit: number
          total_win: number
          total_withdraw: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          client_timestamp?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string
          sync_count?: number
          total_bet?: number
          total_deposit?: number
          total_loss?: number
          total_profit?: number
          total_win?: number
          total_withdraw?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          client_timestamp?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string
          sync_count?: number
          total_bet?: number
          total_deposit?: number
          total_loss?: number
          total_profit?: number
          total_win?: number
          total_withdraw?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_user_data: {
        Row: {
          client_id: string
          client_timestamp: string | null
          created_at: string
          data: Json
          id: string
          last_sync_mode: string | null
          sync_count: number
          synced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          client_timestamp?: string | null
          created_at?: string
          data?: Json
          id?: string
          last_sync_mode?: string | null
          sync_count?: number
          synced_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          client_timestamp?: string | null
          created_at?: string
          data?: Json
          id?: string
          last_sync_mode?: string | null
          sync_count?: number
          synced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_tags: {
        Row: {
          created_at: string
          id: string
          post_id: string
          tagged_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          tagged_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          tagged_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          cloudflare_deleted_at: string | null
          content: string
          created_at: string
          delete_attempts: number
          delete_completed_at: string | null
          delete_error: string | null
          delete_metadata: Json
          delete_requested_at: string | null
          delete_status: string
          deleted_at: string | null
          id: string
          image_url: string | null
          location: string | null
          media_urls: Json | null
          metadata: Json
          post_type: string
          r2_deleted_at: string | null
          updated_at: string
          user_id: string
          video_url: string | null
          visibility: string
        }
        Insert: {
          cloudflare_deleted_at?: string | null
          content: string
          created_at?: string
          delete_attempts?: number
          delete_completed_at?: string | null
          delete_error?: string | null
          delete_metadata?: Json
          delete_requested_at?: string | null
          delete_status?: string
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          media_urls?: Json | null
          metadata?: Json
          post_type?: string
          r2_deleted_at?: string | null
          updated_at?: string
          user_id: string
          video_url?: string | null
          visibility?: string
        }
        Update: {
          cloudflare_deleted_at?: string | null
          content?: string
          created_at?: string
          delete_attempts?: number
          delete_completed_at?: string | null
          delete_error?: string | null
          delete_metadata?: Json
          delete_requested_at?: string | null
          delete_status?: string
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          media_urls?: Json | null
          metadata?: Json
          post_type?: string
          r2_deleted_at?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_cache: {
        Row: {
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_notes: string | null
          approved_reward: number
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          cross_platform_data: Json | null
          custodial_wallet_address: string | null
          default_wallet_type: string | null
          email_claimed: string | null
          email_verified_at: string | null
          external_wallet_address: string | null
          financial_updated_at: string | null
          full_name: string | null
          fun_id: string | null
          grand_total_bet: number
          grand_total_deposit: number
          grand_total_loss: number
          grand_total_profit: number
          grand_total_win: number
          grand_total_withdraw: number
          has_password_set: boolean | null
          id: string
          is_banned: boolean
          is_restricted: boolean
          last_login_platform: string | null
          last_wallet_changed_at: string | null
          law_of_light_accepted: boolean
          law_of_light_accepted_at: string | null
          oauth_provider: string | null
          pending_reward: number
          pinned_post_id: string | null
          registered_from: string | null
          reward_status: string
          soul_level: number
          total_rewards: number
          trust_level: number
          updated_at: string
          username: string
          wallet_address: string | null
          wallet_verified_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_reward?: number
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          cross_platform_data?: Json | null
          custodial_wallet_address?: string | null
          default_wallet_type?: string | null
          email_claimed?: string | null
          email_verified_at?: string | null
          external_wallet_address?: string | null
          financial_updated_at?: string | null
          full_name?: string | null
          fun_id?: string | null
          grand_total_bet?: number
          grand_total_deposit?: number
          grand_total_loss?: number
          grand_total_profit?: number
          grand_total_win?: number
          grand_total_withdraw?: number
          has_password_set?: boolean | null
          id: string
          is_banned?: boolean
          is_restricted?: boolean
          last_login_platform?: string | null
          last_wallet_changed_at?: string | null
          law_of_light_accepted?: boolean
          law_of_light_accepted_at?: string | null
          oauth_provider?: string | null
          pending_reward?: number
          pinned_post_id?: string | null
          registered_from?: string | null
          reward_status?: string
          soul_level?: number
          total_rewards?: number
          trust_level?: number
          updated_at?: string
          username: string
          wallet_address?: string | null
          wallet_verified_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_reward?: number
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          cross_platform_data?: Json | null
          custodial_wallet_address?: string | null
          default_wallet_type?: string | null
          email_claimed?: string | null
          email_verified_at?: string | null
          external_wallet_address?: string | null
          financial_updated_at?: string | null
          full_name?: string | null
          fun_id?: string | null
          grand_total_bet?: number
          grand_total_deposit?: number
          grand_total_loss?: number
          grand_total_profit?: number
          grand_total_win?: number
          grand_total_withdraw?: number
          has_password_set?: boolean | null
          id?: string
          is_banned?: boolean
          is_restricted?: boolean
          last_login_platform?: string | null
          last_wallet_changed_at?: string | null
          law_of_light_accepted?: boolean
          law_of_light_accepted_at?: string | null
          oauth_provider?: string | null
          pending_reward?: number
          pinned_post_id?: string | null
          registered_from?: string | null
          reward_status?: string
          soul_level?: number
          total_rewards?: number
          trust_level?: number
          updated_at?: string
          username?: string
          wallet_address?: string | null
          wallet_verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_pinned_post_id_fkey"
            columns: ["pinned_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_state: {
        Row: {
          count: number
          expires_at: string
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          expires_at: string
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          expires_at?: string
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_logs: {
        Row: {
          auto_adjusted: boolean | null
          discrepancies: Json | null
          id: string
          level: number
          notes: string | null
          run_at: string
          run_by: string | null
          status: string
          total_checked: number | null
          total_mismatched: number | null
        }
        Insert: {
          auto_adjusted?: boolean | null
          discrepancies?: Json | null
          id?: string
          level?: number
          notes?: string | null
          run_at?: string
          run_by?: string | null
          status?: string
          total_checked?: number | null
          total_mismatched?: number | null
        }
        Update: {
          auto_adjusted?: boolean | null
          discrepancies?: Json | null
          id?: string
          level?: number
          notes?: string | null
          run_at?: string
          run_by?: string | null
          status?: string
          total_checked?: number | null
          total_mismatched?: number | null
        }
        Relationships: []
      }
      red_envelope_claims: {
        Row: {
          amount: number
          claimed_at: string
          claimer_id: string
          envelope_id: string
          id: string
        }
        Insert: {
          amount: number
          claimed_at?: string
          claimer_id: string
          envelope_id: string
          id?: string
        }
        Update: {
          amount?: number
          claimed_at?: string
          claimer_id?: string
          envelope_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "red_envelope_claims_claimer_id_fkey"
            columns: ["claimer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelope_claims_claimer_id_fkey"
            columns: ["claimer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelope_claims_envelope_id_fkey"
            columns: ["envelope_id"]
            isOneToOne: false
            referencedRelation: "red_envelopes"
            referencedColumns: ["id"]
          },
        ]
      }
      red_envelopes: {
        Row: {
          conversation_id: string
          created_at: string
          creator_id: string
          expires_at: string
          greeting: string | null
          id: string
          message_id: string | null
          remaining_amount: number
          remaining_count: number
          status: string
          token: string
          total_amount: number
          total_count: number
        }
        Insert: {
          conversation_id: string
          created_at?: string
          creator_id: string
          expires_at?: string
          greeting?: string | null
          id?: string
          message_id?: string | null
          remaining_amount: number
          remaining_count: number
          status?: string
          token?: string
          total_amount: number
          total_count: number
        }
        Update: {
          conversation_id?: string
          created_at?: string
          creator_id?: string
          expires_at?: string
          greeting?: string | null
          id?: string
          message_id?: string | null
          remaining_amount?: number
          remaining_count?: number
          status?: string
          token?: string
          total_amount?: number
          total_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "red_envelopes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelopes_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelopes_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelopes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          conversation_id: string | null
          created_at: string
          details: string | null
          id: string
          message_id: string | null
          reason: string
          reported_user_id: string | null
          reporter_id: string
          status: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          message_id?: string | null
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          status?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          message_id?: string | null
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_adjustments: {
        Row: {
          admin_id: string
          amount: number
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          admin_id: string
          amount: number
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          admin_id?: string
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_approvals: {
        Row: {
          admin_id: string
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          reviewed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_id: string
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_claims: {
        Row: {
          amount: number
          created_at: string
          id: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      reward_pending: {
        Row: {
          action_type: string
          amount: number
          created_at: string
          id: string
          processed_at: string | null
          status: string
          unlock_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          amount?: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string
          unlock_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          amount?: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string
          unlock_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_pending_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_pending_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_logs: {
        Row: {
          created_at: string
          id: string
          search_query: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          search_query: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          search_query?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_posts: {
        Row: {
          created_at: string
          id: string
          original_post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_posts_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      siwe_nonces: {
        Row: {
          address: string
          created_at: string
          expires_at: string
          id: string
          nonce: string
          used_at: string | null
        }
        Insert: {
          address: string
          created_at?: string
          expires_at: string
          id?: string
          nonce: string
          used_at?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string
          used_at?: string | null
        }
        Relationships: []
      }
      soul_nfts: {
        Row: {
          chain_id: number
          contract_address: string | null
          created_at: string
          experience_points: number
          id: string
          is_minted: boolean
          metadata_uri: string | null
          minted_at: string | null
          soul_element: string | null
          soul_level: number
          soul_name: string | null
          token_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chain_id?: number
          contract_address?: string | null
          created_at?: string
          experience_points?: number
          id?: string
          is_minted?: boolean
          metadata_uri?: string | null
          minted_at?: string | null
          soul_element?: string | null
          soul_level?: number
          soul_name?: string | null
          token_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chain_id?: number
          contract_address?: string | null
          created_at?: string
          experience_points?: number
          id?: string
          is_minted?: boolean
          metadata_uri?: string | null
          minted_at?: string | null
          soul_element?: string | null
          soul_level?: number
          soul_name?: string | null
          token_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "soul_nfts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soul_nfts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sticker_packs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_free: boolean
          name: string
          preview_url: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          name: string
          preview_url: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          name?: string
          preview_url?: string
          sort_order?: number
        }
        Relationships: []
      }
      stickers: {
        Row: {
          created_at: string
          id: string
          is_animated: boolean
          name: string
          pack_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_animated?: boolean
          name: string
          pack_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_animated?: boolean
          name?: string
          pack_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "stickers_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "sticker_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      streams: {
        Row: {
          created_at: string
          duration: number | null
          id: string
          status: string
          title: string | null
          updated_at: string
          user_id: string
          video_path: string | null
        }
        Insert: {
          created_at?: string
          duration?: number | null
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
          video_path?: string | null
        }
        Update: {
          created_at?: string
          duration?: number | null
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          video_path?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: string
          chain_id: number
          created_at: string
          from_address: string
          id: string
          status: string
          to_address: string
          token_address: string | null
          token_symbol: string
          tx_hash: string
          user_id: string
        }
        Insert: {
          amount: string
          chain_id: number
          created_at?: string
          from_address: string
          id?: string
          status?: string
          to_address: string
          token_address?: string | null
          token_symbol: string
          tx_hash: string
          user_id: string
        }
        Update: {
          amount?: string
          chain_id?: number
          created_at?: string
          from_address?: string
          id?: string
          status?: string
          to_address?: string
          token_address?: string | null
          token_symbol?: string
          tx_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      user_action_log: {
        Row: {
          action_type: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_action_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_action_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_device_fingerprint: {
        Row: {
          created_at: string
          device_hash: string
          id: string
          ip_hash: string
          user_agent_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_hash: string
          id?: string
          ip_hash: string
          user_agent_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_hash?: string
          id?: string
          ip_hash?: string
          user_agent_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_device_fingerprint_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_device_fingerprint_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stake_status: {
        Row: {
          created_at: string
          fun_balance: number
          last_checked_at: string | null
          meets_requirement: boolean
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          fun_balance?: number
          last_checked_at?: string | null
          meets_requirement?: boolean
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          fun_balance?: number
          last_checked_at?: string | null
          meets_requirement?: boolean
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_stake_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stake_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_trust: {
        Row: {
          account_age_score: number
          engagement_score: number
          fingerprint_penalty: number
          flag_reason: string | null
          is_flagged: boolean
          report_penalty: number
          trust_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_age_score?: number
          engagement_score?: number
          fingerprint_penalty?: number
          flag_reason?: string | null
          is_flagged?: boolean
          report_penalty?: number
          trust_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_age_score?: number
          engagement_score?: number
          fingerprint_penalty?: number
          flag_reason?: string | null
          is_flagged?: boolean
          report_penalty?: number
          trust_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_trust_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_trust_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_wallets: {
        Row: {
          address: string
          chain_id: number | null
          created_at: string
          id: string
          is_primary: boolean
          user_id: string
          verified_at: string | null
          wallet_network: string
        }
        Insert: {
          address: string
          chain_id?: number | null
          created_at?: string
          id?: string
          is_primary?: boolean
          user_id: string
          verified_at?: string | null
          wallet_network?: string
        }
        Update: {
          address?: string
          chain_id?: number | null
          created_at?: string
          id?: string
          is_primary?: boolean
          user_id?: string
          verified_at?: string | null
          wallet_network?: string
        }
        Relationships: []
      }
      wallet_auth_attempts: {
        Row: {
          address: string | null
          attempt_type: string
          created_at: string
          id: string
          ip_hash: string | null
          reason: string | null
          success: boolean
          ua_hash: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          attempt_type: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          reason?: string | null
          success: boolean
          ua_hash?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          attempt_type?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          reason?: string | null
          success?: boolean
          ua_hash?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      wallet_links: {
        Row: {
          address: string
          chain_id: number
          created_at: string
          id: string
          label: string | null
          last_seen_at: string | null
          user_id: string
          verified_at: string
        }
        Insert: {
          address: string
          chain_id: number
          created_at?: string
          id?: string
          label?: string | null
          last_seen_at?: string | null
          user_id: string
          verified_at?: string
        }
        Update: {
          address?: string
          chain_id?: number
          created_at?: string
          id?: string
          label?: string | null
          last_seen_at?: string | null
          user_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_nonces: {
        Row: {
          address: string
          chain_id: number
          created_at: string
          expires_at: string
          id: string
          issued_at: string
          nonce: string
          purpose: string | null
          requested_by_user_id: string | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          address: string
          chain_id: number
          created_at?: string
          expires_at: string
          id?: string
          issued_at?: string
          nonce: string
          purpose?: string | null
          requested_by_user_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string
          chain_id?: number
          created_at?: string
          expires_at?: string
          id?: string
          issued_at?: string
          nonce?: string
          purpose?: string | null
          requested_by_user_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_nonces_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_nonces_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_rate_limits: {
        Row: {
          count: number
          created_at: string
          expires_at: string
          key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          created_at?: string
          expires_at: string
          key: string
          updated_at?: string
          window_start: string
        }
        Update: {
          count?: number
          created_at?: string
          expires_at?: string
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      user_custodial_wallets: {
        Row: {
          chain_id: number | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          last_activity_at: string | null
          updated_at: string | null
          user_id: string | null
          wallet_address: string | null
        }
        Insert: {
          chain_id?: number | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_activity_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          wallet_address?: string | null
        }
        Update: {
          chain_id?: number | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_activity_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custodial_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodial_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_user_reward: {
        Args: { p_admin_id: string; p_note?: string; p_user_id: string }
        Returns: number
      }
      attach_live_replay_to_post: {
        Args: {
          _duration_seconds?: number
          _playback_url: string
          _session_id: string
          _thumbnail_url?: string
        }
        Returns: {
          agora_channel: string | null
          agora_uid_host: number | null
          archive_error: string | null
          archive_status: string
          archived_at: string | null
          auto_posted_at: string | null
          channel_name: string
          cloudflare_live_input_id: string | null
          cloudflare_mp4_download_url: string | null
          cloudflare_playback_url: string | null
          cloudflare_video_uid: string | null
          created_at: string
          ended_at: string | null
          hls_playback_url: string | null
          hls_url: string | null
          host_user_id: string
          id: string
          last_worker_response: Json | null
          live_mode: string
          owner_id: string | null
          playback_provider: string | null
          post_id: string | null
          privacy: string
          processing_started_at: string | null
          r2_bucket: string | null
          r2_object_key: string | null
          r2_video_url: string | null
          recording_acquired_at: string | null
          recording_error: string | null
          recording_ready_at: string | null
          recording_started_at: string | null
          recording_status: string | null
          recording_stopped_at: string | null
          recording_uid: number | null
          resource_id: string | null
          rtmp_ended_at: string | null
          rtmp_started_at: string | null
          rtmp_status: string | null
          sid: string | null
          source: string | null
          started_at: string
          status: string
          storage_provider: string | null
          stream_deleted_at: string | null
          stream_key: string | null
          stream_provider: string
          title: string
          updated_at: string
          viewer_count: number
        }
        SetofOptions: {
          from: "*"
          to: "live_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ban_user_permanently: {
        Args: { p_admin_id: string; p_reason?: string; p_user_id: string }
        Returns: boolean
      }
      calculate_engagement_quality: {
        Args: { p_user_id: string }
        Returns: number
      }
      calculate_trust_score: { Args: { p_user_id: string }; Returns: number }
      check_action_rate_limit: {
        Args: { p_action_type: string; p_user_id: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_ms?: number }
        Returns: Json
      }
      claim_red_envelope: { Args: { p_envelope_id: string }; Returns: number }
      cleanup_expired_oauth_data: { Args: never; Returns: undefined }
      decrement_live_viewer_count: {
        Args: { session_id: string }
        Returns: undefined
      }
      delete_storage_object: {
        Args: { bucket_name: string; object_path: string }
        Returns: undefined
      }
      detect_device_clusters: {
        Args: never
        Returns: {
          device_hash: string
          user_count: number
          user_ids: string[]
          usernames: string[]
        }[]
      }
      end_livestream: { Args: { p_livestream_id: string }; Returns: boolean }
      find_user_id_by_email: { Args: { p_email: string }; Returns: string }
      generate_secure_token: { Args: { length?: number }; Returns: string }
      get_app_stats: {
        Args: never
        Returns: {
          total_photos: number
          total_posts: number
          total_rewards: number
          total_users: number
          total_videos: number
        }[]
      }
      get_live_recording_context: {
        Args: { _session_id: string }
        Returns: {
          agora_channel: string
          channel_name: string
          host_user_id: string
          id: string
          last_worker_response: Json
          post_id: string
          recording_error: string
          recording_ready_at: string
          recording_started_at: string
          recording_status: string
          recording_stopped_at: string
          recording_uid: number
          resource_id: string
          sid: string
        }[]
      }
      get_user_rewards: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          comments_count: number
          friends_count: number
          id: string
          posts_count: number
          reactions_count: number
          reactions_on_posts: number
          shares_count: number
          total_reward: number
          username: string
        }[]
      }
      get_user_rewards_v2: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          comments_count: number
          friends_count: number
          id: string
          livestreams_count: number
          posts_count: number
          reactions_count: number
          reactions_on_posts: number
          shares_count: number
          today_reward: number
          total_reward: number
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_live_viewer_count: {
        Args: { session_id: string }
        Returns: undefined
      }
      is_conversation_admin: {
        Args: { check_user_id: string; conv_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { check_user_id: string; conv_id: string }
        Returns: boolean
      }
      log_user_action: {
        Args: { p_action_type: string; p_user_id: string }
        Returns: Json
      }
      mark_live_replay_uploaded: {
        Args: { _replay_id: string }
        Returns: undefined
      }
      normalize_username: { Args: { input_text: string }; Returns: string }
      pin_message: { Args: { p_message_id: string }; Returns: undefined }
      recalculate_user_financial:
        | { Args: { p_client_id?: string; p_user_id: string }; Returns: Json }
        | {
            Args: {
              p_admin_id?: string
              p_client_id?: string
              p_user_id: string
            }
            Returns: Json
          }
      reject_user_reward: {
        Args: { p_admin_id: string; p_note?: string; p_user_id: string }
        Returns: number
      }
      run_financial_reconciliation: {
        Args: { p_admin_id?: string }
        Returns: Json
      }
      set_live_recording_state: {
        Args: {
          _last_worker_response?: Json
          _recording_error?: string
          _recording_ready_at?: string
          _recording_started_at?: string
          _recording_status?: string
          _recording_stopped_at?: string
          _recording_uid?: number
          _resource_id?: string
          _session_id: string
          _sid?: string
        }
        Returns: {
          agora_channel: string | null
          agora_uid_host: number | null
          archive_error: string | null
          archive_status: string
          archived_at: string | null
          auto_posted_at: string | null
          channel_name: string
          cloudflare_live_input_id: string | null
          cloudflare_mp4_download_url: string | null
          cloudflare_playback_url: string | null
          cloudflare_video_uid: string | null
          created_at: string
          ended_at: string | null
          hls_playback_url: string | null
          hls_url: string | null
          host_user_id: string
          id: string
          last_worker_response: Json | null
          live_mode: string
          owner_id: string | null
          playback_provider: string | null
          post_id: string | null
          privacy: string
          processing_started_at: string | null
          r2_bucket: string | null
          r2_object_key: string | null
          r2_video_url: string | null
          recording_acquired_at: string | null
          recording_error: string | null
          recording_ready_at: string | null
          recording_started_at: string | null
          recording_status: string | null
          recording_stopped_at: string | null
          recording_uid: number | null
          resource_id: string | null
          rtmp_ended_at: string | null
          rtmp_started_at: string | null
          rtmp_status: string | null
          sid: string | null
          source: string | null
          started_at: string
          status: string
          storage_provider: string | null
          stream_deleted_at: string | null
          stream_key: string | null
          stream_provider: string
          title: string
          updated_at: string
          viewer_count: number
        }
        SetofOptions: {
          from: "*"
          to: "live_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_live_recording_stopped: {
        Args: { _file_list?: Json; _media_url?: string; _session_id: string }
        Returns: undefined
      }
      sync_profiles_legacy_wallet_fields: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      unpin_message: { Args: { p_message_id: string }; Returns: undefined }
      upsert_live_recording_row: {
        Args: {
          _duration_seconds?: number
          _file_list_json?: Json
          _media_url?: string
          _raw_response?: Json
          _recorder_uid?: string
          _resource_id?: string
          _session_id: string
          _sid?: string
          _status?: string
          _stopped_at?: string
          _thumbnail_url?: string
        }
        Returns: {
          created_at: string | null
          delete_error: string | null
          deleted_at: string | null
          duration_seconds: number | null
          file_list_json: Json | null
          id: string
          live_id: string | null
          media_url: string | null
          mode: string | null
          raw_response: Json | null
          recorder_uid: string | null
          resource_id: string | null
          sid: string | null
          status: string | null
          stopped_at: string | null
          storage_region: number | null
          storage_vendor: number | null
          thumbnail_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "live_recordings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const

````

### `supabase/config.toml`

````toml
project_id = "lramftbsjrqyysdqlfdg"

[functions.wallet-nonce]
verify_jwt = false

[functions.wallet-link]
verify_jwt = false

[functions.wallet-login]
verify_jwt = false

[functions.wallet-verify]
verify_jwt = true

[functions.siwe-nonce]
verify_jwt = false

[functions.siwe-verify]
verify_jwt = false

[functions.email-link-start]
verify_jwt = false

[functions.email-link-verify]
verify_jwt = false

[functions.me-unified]
verify_jwt = true

[functions.connect-external-wallet]
verify_jwt = true

[functions.disconnect-external-wallet]
verify_jwt = true

[functions.price-proxy]
verify_jwt = false

[functions.live-replay-create-upload]
verify_jwt = true

[functions.live-rtmp]
verify_jwt = true

[functions.stream-webhook]
verify_jwt = false

[functions.stream-mp4-finalize]
verify_jwt = false

[functions.reconcile-pending-replays]
verify_jwt = false

[functions.delete-post]
verify_jwt = true

[functions.retry-post-video-deletes]
verify_jwt = false

[functions.archive-replay-to-r2]
verify_jwt = false

[functions.retry-archive-replays]
verify_jwt = false


````

