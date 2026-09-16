# Cloudflare Stream Livestream Replay Pipeline Package

This package contains the complete source needed to integrate the production-grade Cloudflare Stream livestream replay pipeline into FUN PROFILE.

## Feature Name

**Cloudflare Stream Livestream Replay Pipeline**

## Goal

Replace production replay playback based on WebM chunk manifests with Cloudflare Stream VOD playback:

Agora WebRTC -> MediaRecorder VP8/Opus WebM -> ts-ebml duration fix -> Cloudflare Stream Direct Upload -> Stream transcode -> webhook DB update -> HLS replay playback.

## Required Dependencies

Add these dependencies to `package.json`:

```json
{
  "dependencies": {
    "buffer": "^6.0.3",
    "hls.js": "^1.6.15",
    "ts-ebml": "^3.0.2",
    "tus-js-client": "^4.3.1"
  }
}
```

`hls.js` and `tus-js-client` may already exist in FUN PROFILE. `ts-ebml` and `buffer` are required for seekable WebM metadata fixing in the browser.

## Required Secrets

Set these Supabase Edge Function secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_STREAM_TOKEN
CLOUDFLARE_STREAM_API_TOKEN       # optional fallback name if already used
CLOUDFLARE_STREAM_CUSTOMER_CODE
CLOUDFLARE_STREAM_WEBHOOK_SECRET
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## Supabase Function Config

Add to `supabase/config.toml`:

```toml
[functions.live-replay-create-upload]
verify_jwt = true

[functions.stream-webhook]
verify_jwt = false
```

## Cloudflare Webhook

Configure Cloudflare Stream webhook URL:

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/stream-webhook
```

The webhook function verifies Cloudflare `Webhook-Signature` using `CLOUDFLARE_STREAM_WEBHOOK_SECRET`.

## Playback URL Pattern

```text
HLS:       https://customer-{CODE}.cloudflarestream.com/{UID}/manifest/video.m3u8
DASH:      https://customer-{CODE}.cloudflarestream.com/{UID}/manifest/video.mpd
MP4:       https://customer-{CODE}.cloudflarestream.com/{UID}/downloads/default.mp4
Thumbnail: https://customer-{CODE}.cloudflarestream.com/{UID}/thumbnails/thumbnail.jpg?time=3s
```

## Source Code

---

### FILE: supabase/migrations/20260504071500_live_replays_cloudflare_stream.sql

```sql
-- Production-grade Cloudflare Stream replay pipeline for livestream VOD.

CREATE TABLE IF NOT EXISTS public.live_replays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  live_session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  chunked_recording_id uuid REFERENCES public.live_recordings(id) ON DELETE SET NULL,
  source_webm_key text,
  stream_uid text NOT NULL UNIQUE,
  playback_hls text,
  playback_dash text,
  playback_mp4 text,
  thumbnail_url text,
  duration_seconds integer,
  filesize_bytes bigint,
  status text NOT NULL DEFAULT 'uploading',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_replays_status_check
    CHECK (status IN ('uploading', 'queued', 'processing', 'ready', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_live_replays_session_created
  ON public.live_replays(live_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_replays_user_created
  ON public.live_replays(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_replays_status
  ON public.live_replays(status, updated_at DESC);

DROP TRIGGER IF EXISTS update_live_replays_updated_at ON public.live_replays;
CREATE TRIGGER update_live_replays_updated_at
BEFORE UPDATE ON public.live_replays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.live_replays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read ready live replays" ON public.live_replays;
CREATE POLICY "Public can read ready live replays"
ON public.live_replays
FOR SELECT
USING (status = 'ready');

DROP POLICY IF EXISTS "Hosts can read own live replays" ON public.live_replays;
CREATE POLICY "Hosts can read own live replays"
ON public.live_replays
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.live_sessions ls
    WHERE ls.id = live_replays.live_session_id
      AND (ls.host_user_id = auth.uid() OR ls.owner_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Service role manages live replays" ON public.live_replays;
CREATE POLICY "Service role manages live replays"
ON public.live_replays
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_recording_status_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_recording_status_check
  CHECK (recording_status IN ('idle', 'acquired', 'acquiring', 'starting', 'recording', 'uploading', 'queued', 'processing', 'ready', 'stopped', 'failed'));

CREATE OR REPLACE FUNCTION public.mark_live_replay_uploaded(_replay_id uuid)
RETURNS public.live_replays
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.live_replays;
BEGIN
  UPDATE public.live_replays lr
  SET status = 'queued',
      updated_at = now()
  WHERE lr.id = _replay_id
    AND lr.user_id = auth.uid()
    AND lr.status = 'uploading'
  RETURNING lr.* INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'live replay not found or not uploadable';
  END IF;

  UPDATE public.live_sessions ls
  SET recording_status = 'processing',
      updated_at = now()
  WHERE ls.id = _row.live_session_id;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_live_replay_uploaded(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_live_replay_uploaded(uuid) TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.live_replays;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;

```

---

### FILE: supabase/functions/live-replay-create-upload/index.ts

```ts
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BASIC_UPLOAD_LIMIT_BYTES = 200 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
    const streamToken =
      Deno.env.get("CLOUDFLARE_STREAM_TOKEN") ??
      Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN") ??
      "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Missing Supabase configuration" }, 500);
    }
    if (!accountId || !streamToken) {
      return json({ error: "Missing Cloudflare Stream configuration" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const liveSessionId = String(body.live_session_id || "");
    const chunkedRecordingId = body.chunked_recording_id ? String(body.chunked_recording_id) : null;
    const expectedSize = Number(body.expected_size || 0);
    const sourceWebmKey = body.source_webm_key ? String(body.source_webm_key) : null;

    if (!liveSessionId || !Number.isFinite(expectedSize) || expectedSize <= 0) {
      return json({ error: "live_session_id and expected_size are required" }, 400);
    }

    const { data: live, error: liveError } = await serviceClient
      .from("live_sessions")
      .select("id, host_user_id, owner_id, post_id, title")
      .eq("id", liveSessionId)
      .maybeSingle();

    if (liveError) throw liveError;
    if (!live) return json({ error: "Live session not found" }, 404);

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    const isHost = live.host_user_id === user.id || live.owner_id === user.id;
    if (!isHost && !isAdmin) return json({ error: "Forbidden" }, 403);

    const safeName = `fun-live-replay-${liveSessionId}.webm`;
    const useTus = expectedSize > BASIC_UPLOAD_LIMIT_BYTES;

    let uploadURL = "";
    let streamUid = "";
    const uploadMethod: "form" | "tus" = useTus ? "tus" : "form";

    if (useTus) {
      const metadata = [
        `maxDurationSeconds ${b64("36000")}`,
        `requiresignedurls ${b64("false")}`,
        `name ${b64(safeName)}`,
        `filename ${b64(safeName)}`,
        `filetype ${b64("video/webm")}`,
      ].join(",");

      const cfResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${streamToken}`,
            "Tus-Resumable": "1.0.0",
            "Upload-Length": String(expectedSize),
            "Upload-Metadata": metadata,
          },
        },
      );

      if (!cfResponse.ok) {
        const detail = await cfResponse.text();
        return json({ error: "Cloudflare TUS upload URL failed", detail }, 502);
      }

      uploadURL = cfResponse.headers.get("Location") || "";
      streamUid = cfResponse.headers.get("stream-media-id") || "";
    } else {
      const cfResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${streamToken}`,
            "Content-Type": "application/json",
            "Upload-Creator": user.id,
          },
          body: JSON.stringify({
            maxDurationSeconds: 36000,
            requireSignedURLs: false,
            allowedOrigins: ["*"],
            meta: {
              replay_id: "",
              live_session_id: liveSessionId,
              user_id: user.id,
              filename: safeName,
              filetype: "video/webm",
            },
          }),
        },
      );

      if (!cfResponse.ok) {
        const detail = await cfResponse.text();
        return json({ error: "Cloudflare direct upload URL failed", detail }, 502);
      }

      const cfData = await cfResponse.json();
      uploadURL = cfData.result?.uploadURL || "";
      streamUid = cfData.result?.uid || "";
    }

    if (!uploadURL || !streamUid) {
      return json({ error: "Cloudflare did not return upload URL or UID" }, 502);
    }

    const { data: replay, error: replayError } = await serviceClient
      .from("live_replays")
      .insert({
        user_id: user.id,
        live_session_id: liveSessionId,
        chunked_recording_id: chunkedRecordingId,
        source_webm_key: sourceWebmKey,
        stream_uid: streamUid,
        filesize_bytes: expectedSize,
        status: "uploading",
      })
      .select("id")
      .single();

    if (replayError) throw replayError;

    await serviceClient
      .from("live_sessions")
      .update({ recording_status: "uploading", updated_at: new Date().toISOString() })
      .eq("id", liveSessionId);

    return json({
      uploadURL,
      stream_uid: streamUid,
      replay_id: replay.id,
      upload_method: uploadMethod,
    });
  } catch (error) {
    console.error("[live-replay-create-upload]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

```

---

### FILE: supabase/functions/stream-webhook/index.ts

```ts
import { createClient } from "npm:@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const rawBody = await req.text();
    const webhookSecret = Deno.env.get("CLOUDFLARE_STREAM_WEBHOOK_SECRET") ?? "";
    const ok = await verifySignature(rawBody, req.headers.get("Webhook-Signature"), webhookSecret);
    if (!ok) return json({ error: "Invalid webhook signature" }, 401);

    const payload = JSON.parse(rawBody);
    const uid = String(payload.uid || "");
    if (!uid) return json({ error: "Missing uid" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const customerCode = Deno.env.get("CLOUDFLARE_STREAM_CUSTOMER_CODE") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase configuration" }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: replay, error: replayError } = await supabase
      .from("live_replays")
      .select("id, live_session_id")
      .eq("stream_uid", uid)
      .maybeSingle();
    if (replayError) throw replayError;
    if (!replay) return json({ ok: true, ignored: "unknown uid" });

    const state = payload.status?.state || "";
    const errorText =
      payload.status?.errorReasonText ||
      payload.status?.errReasonText ||
      payload.status?.errorReasonCode ||
      payload.status?.errReasonCode ||
      "";

    if (payload.readyToStream === true && state === "ready") {
      const urls = buildUrls(uid, customerCode);
      const playbackHls = payload.playback?.hls || urls.hls;
      const playbackDash = payload.playback?.dash || urls.dash;
      const thumbnailUrl = payload.thumbnail || urls.thumbnail;
      const durationSeconds = Number.isFinite(Number(payload.duration))
        ? Math.round(Number(payload.duration))
        : null;
      const size = Number.isFinite(Number(payload.size)) ? Number(payload.size) : null;

      const { data: updatedReplay, error: updateError } = await supabase
        .from("live_replays")
        .update({
          status: "ready",
          playback_hls: playbackHls,
          playback_dash: playbackDash,
          playback_mp4: urls.mp4,
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
          playback_type: "cloudflare_stream",
          playback_url: playbackHls,
          playback_hls: playbackHls,
          playback_dash: playbackDash,
          playback_mp4: urls.mp4,
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
          recording_ready_at: new Date().toISOString(),
          recording_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", updatedReplay.live_session_id);
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

```

---

### FILE: src/modules/live/recording/webmFinalize.ts

```ts
import { Buffer } from 'buffer';

type TsEbml = typeof import('ts-ebml');

async function loadEbml(): Promise<TsEbml> {
  const globalWithBuffer = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
  if (!globalWithBuffer.Buffer) {
    globalWithBuffer.Buffer = Buffer;
  }
  return import('ts-ebml');
}

export interface FinalizedWebm {
  blob: Blob;
  durationSeconds: number | null;
}

export async function finalizeWebmDuration(blob: Blob): Promise<FinalizedWebm> {
  if (!blob || blob.size === 0) {
    throw new Error('Video recording is empty');
  }

  const ebml = await loadEbml();
  const buffer = await blob.arrayBuffer();
  const decoder = new ebml.Decoder();
  const reader = new ebml.Reader();
  reader.logging = false;
  reader.drop_default_duration = false;

  const elements = decoder.decode(buffer);
  elements.forEach((element) => reader.read(element));
  reader.stop();

  const duration = reader.duration;
  const durationSeconds =
    Number.isFinite(duration) && duration > 0
      ? (duration * reader.timestampScale) / 1_000_000_000
      : null;

  if (!reader.metadatas?.length || !reader.cues?.length || !durationSeconds) {
    return { blob: new Blob([buffer], { type: blob.type || 'video/webm' }), durationSeconds };
  }

  const metadata = ebml.tools.makeMetadataSeekable(reader.metadatas, duration, reader.cues);
  const body = buffer.slice(reader.metadataSize);
  return {
    blob: new Blob([metadata, body], { type: blob.type || 'video/webm' }),
    durationSeconds,
  };
}

```

---

### FILE: src/modules/live/recording/replayRecovery.ts

```ts
const DB_NAME = 'fun-live-replay-recovery';
const DB_VERSION = 1;
const CHUNKS_STORE = 'chunks';
const FINAL_STORE = 'finalized';

type ChunkRecord = {
  sessionId: string;
  sequence: number;
  blob: Blob;
  createdAt: number;
};

type FinalRecord = {
  sessionId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  durationSeconds: number | null;
  replayId?: string;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        db.createObjectStore(CHUNKS_STORE, { keyPath: ['sessionId', 'sequence'] });
      }
      if (!db.objectStoreNames.contains(FINAL_STORE)) {
        db.createObjectStore(FINAL_STORE, { keyPath: 'sessionId' });
      }
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

async function write<T>(storeName: string, value: T): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}

export async function saveReplayChunk(sessionId: string, sequence: number, blob: Blob): Promise<void> {
  if (!sessionId || !blob.size) return;
  await write<ChunkRecord>(CHUNKS_STORE, { sessionId, sequence, blob, createdAt: Date.now() });
}

export async function saveFinalizedReplay(record: Omit<FinalRecord, 'createdAt'>): Promise<void> {
  await write<FinalRecord>(FINAL_STORE, { ...record, createdAt: Date.now() });
}

export async function deleteReplayRecovery(sessionId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([CHUNKS_STORE, FINAL_STORE], 'readwrite');
    tx.objectStore(FINAL_STORE).delete(sessionId);
    const chunks = tx.objectStore(CHUNKS_STORE);
    const req = chunks.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const value = cursor.value as ChunkRecord;
      if (value.sessionId === sessionId) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}

```

---

### FILE: src/modules/live/liveReplayUpload.ts

```ts
import * as tus from 'tus-js-client';
import { supabase } from '@/integrations/supabase/client';

export type LiveReplayUploadMethod = 'form' | 'tus';
export type LiveReplayStatus = 'uploading' | 'queued' | 'processing' | 'ready' | 'failed';

export interface CreateLiveReplayUploadResult {
  uploadURL: string;
  stream_uid: string;
  replay_id: string;
  upload_method: LiveReplayUploadMethod;
}

export interface LiveReplayRow {
  id: string;
  user_id: string;
  live_session_id: string;
  stream_uid: string;
  playback_hls: string | null;
  playback_dash: string | null;
  playback_mp4: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  filesize_bytes: number | null;
  status: LiveReplayStatus;
  error_message: string | null;
}

export async function createLiveReplayUpload(input: {
  liveSessionId: string;
  chunkedRecordingId?: string | null;
  expectedSize: number;
  sourceWebmKey?: string | null;
}): Promise<CreateLiveReplayUploadResult> {
  const { data, error } = await supabase.functions.invoke('live-replay-create-upload', {
    body: {
      live_session_id: input.liveSessionId,
      chunked_recording_id: input.chunkedRecordingId ?? null,
      expected_size: input.expectedSize,
      source_webm_key: input.sourceWebmKey ?? null,
    },
  });
  if (error) throw error;
  if (!data?.uploadURL || !data?.stream_uid || !data?.replay_id) {
    throw new Error('Invalid replay upload response');
  }
  return data as CreateLiveReplayUploadResult;
}

export function uploadReplayToCloudflare(input: {
  blob: Blob;
  uploadURL: string;
  method: LiveReplayUploadMethod;
  filename: string;
  onProgress?: (percent: number) => void;
}): Promise<void> {
  if (input.method === 'tus') {
    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(input.blob, {
        uploadUrl: input.uploadURL,
        chunkSize: 150 * 1024 * 1024,
        retryDelays: [0, 1000, 3000, 5000],
        removeFingerprintOnSuccess: true,
        metadata: {
          filename: input.filename,
          filetype: input.blob.type || 'video/webm',
        },
        onError: reject,
        onProgress: (bytesUploaded, bytesTotal) => {
          if (bytesTotal > 0) {
            input.onProgress?.(Math.round((bytesUploaded / bytesTotal) * 100));
          }
        },
        onSuccess: () => resolve(),
      });
      upload.start();
    });
  }

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', new File([input.blob], input.filename, { type: input.blob.type || 'video/webm' }));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', input.uploadURL);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      input.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Cloudflare upload failed: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Cloudflare upload failed - network error'));
    xhr.send(formData);
  });
}

export async function markLiveReplayUploaded(replayId: string): Promise<void> {
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args: Record<string, string>
  ) => Promise<{ error: Error | null }>;
  const { error } = await rpc('mark_live_replay_uploaded', { _replay_id: replayId });
  if (error) throw error;
}

```

---

### FILE: src/modules/live/components/ReplayPlayer.tsx

```tsx
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2, Maximize, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReplayPlayerProps {
  src: string;
  poster?: string | null;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
}

export function ReplayPlayer({
  src,
  poster,
  className,
  autoPlay = false,
  muted = false,
  controls = true,
}: ReplayPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setIsLoading(true);
    setError(null);
    hlsRef.current?.destroy();
    hlsRef.current = null;
    video.removeAttribute('src');
    video.load();

    const markReady = () => {
      setIsLoading(false);
      setIsBuffering(false);
      if (autoPlay) video.play().catch(() => undefined);
    };
    const markBuffering = () => setIsBuffering(true);
    const clearBuffering = () => setIsBuffering(false);
    const markError = () => {
      setIsLoading(false);
      setError('Video replay is not available yet.');
    };

    video.addEventListener('loadedmetadata', markReady);
    video.addEventListener('waiting', markBuffering);
    video.addEventListener('playing', clearBuffering);
    video.addEventListener('canplay', clearBuffering);
    video.addEventListener('error', markError);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        startLevel: -1,
        backBufferLength: 60,
        maxBufferLength: 60,
        manifestLoadingMaxRetry: 4,
        fragLoadingMaxRetry: 4,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, markReady);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }
        setError('HLS playback failed.');
        setIsLoading(false);
      });
    } else {
      setError('HLS playback is not supported in this browser.');
      setIsLoading(false);
    }

    return () => {
      video.removeEventListener('loadedmetadata', markReady);
      video.removeEventListener('waiting', markBuffering);
      video.removeEventListener('playing', clearBuffering);
      video.removeEventListener('canplay', clearBuffering);
      video.removeEventListener('error', markError);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [autoPlay, retryKey, src]);

  return (
    <div className={cn('relative bg-black overflow-hidden', className)}>
      <video
        ref={videoRef}
        poster={poster || undefined}
        preload="metadata"
        playsInline
        muted={muted}
        controls={controls}
        className="w-full h-full object-contain"
      />

      {(isLoading || isBuffering) && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/35 pointer-events-none">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white p-4 text-center">
          <p className="text-sm">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => setRetryKey((x) => x + 1)}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      {!error && (
        <button
          type="button"
          onClick={() => videoRef.current?.requestFullscreen?.()}
          className="absolute top-3 right-3 h-9 w-9 rounded bg-black/60 text-white inline-flex items-center justify-center hover:bg-black/80"
          aria-label="Fullscreen"
        >
          <Maximize className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default ReplayPlayer;

```

---

### FILE: src/modules/live/recording/clientRecorder.ts

```ts
export type RecorderState =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'stopping'
  | 'stopped'
  | 'failed';

export interface CreateRecorderOptions {
  timesliceMs?: number;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
  onStateChange?: (state: RecorderState) => void;
  onChunk?: (chunk: Blob, sequence: number) => void;
  onError?: (error: unknown) => void;
}

export interface RecorderController {
  start: () => void;
  stop: () => Promise<Blob>;
  getBlob: () => Blob | null;
  getMimeType: () => string;
  getSize: () => number;
  getState: () => RecorderState;
}

const DEFAULT_TIMESLICE_MS = 1500;
const DEFAULT_VIDEO_BPS = 1_500_000; // 1.5 Mbps â€“ good quality for replay
const DEFAULT_AUDIO_BPS = 64_000;    // 64 kbps
const MIME_CANDIDATES = ['video/webm;codecs=vp8,opus', 'video/webm'];

function resolveMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported in this browser');
  }

  for (const mimeType of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  throw new Error('No supported recording mime type found');
}

export function createRecorder(
  stream: MediaStream,
  opts: CreateRecorderOptions = {}
): RecorderController {
  const mimeType = resolveMimeType();
  const timesliceMs = opts.timesliceMs ?? DEFAULT_TIMESLICE_MS;
  const videoBitsPerSecond = opts.videoBitsPerSecond ?? DEFAULT_VIDEO_BPS;
  const audioBitsPerSecond = opts.audioBitsPerSecond ?? DEFAULT_AUDIO_BPS;
  const chunks: BlobPart[] = [];
  let blob: Blob | null = null;
  let size = 0;
  let state: RecorderState = 'idle';
  let sequence = 0;

  const setState = (nextState: RecorderState) => {
    state = nextState;
    opts.onStateChange?.(nextState);
  };

  let mediaRecorder: MediaRecorder;
  try {
    mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond, audioBitsPerSecond });
  } catch (error) {
    setState('failed');
    opts.onError?.(error);
    throw error;
  }

  mediaRecorder.ondataavailable = (event: BlobEvent) => {
    if (!event.data || event.data.size === 0) return;
    chunks.push(event.data);
    size += event.data.size;
    opts.onChunk?.(event.data, sequence);
    sequence += 1;
  };

  mediaRecorder.onerror = (event) => {
    setState('failed');
    opts.onError?.(event);
  };

  return {
    start: () => {
      if (mediaRecorder.state !== 'inactive') return;
      setState('starting');
      blob = null;
      size = 0;
      sequence = 0;
      chunks.length = 0;

      try {
        mediaRecorder.start(timesliceMs);
        setState('recording');
      } catch (error) {
        setState('failed');
        opts.onError?.(error);
      }
    },
    stop: () =>
      new Promise<Blob>((resolve, reject) => {
        if (mediaRecorder.state === 'inactive') {
          if (blob) return resolve(blob);
          const emptyBlob = new Blob(chunks, { type: mimeType });
          blob = emptyBlob;
          setState('stopped');
          return resolve(emptyBlob);
        }

        setState('stopping');

        mediaRecorder.onstop = () => {
          blob = new Blob(chunks, { type: mimeType });
          setState('stopped');
          resolve(blob);
        };

        try {
          mediaRecorder.stop();
        } catch (error) {
          setState('failed');
          opts.onError?.(error);
          reject(error);
        }
      }),
    getBlob: () => blob,
    getMimeType: () => mimeType,
    getSize: () => size,
    getState: () => state,
  };
}

```

---

### FILE: src/modules/live/pages/LiveHostPage.tsx

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigate, useParams } from 'react-router-dom';
import { Eye, Home, Loader2, Mic, MicOff, PhoneOff, Radio, RefreshCw, Video, VideoOff } from 'lucide-react';
import { toast } from 'sonner';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import { supabase } from '@/integrations/supabase/client';
import {
  createLiveSession,
  finalizeLiveSession,
  updateLiveViewerCount,
  type RecordingStatus,
} from '../liveService';
import {
  createLiveReplayUpload,
  markLiveReplayUploaded,
  uploadReplayToCloudflare,
  type LiveReplayRow,
  type LiveReplayStatus,
} from '../liveReplayUpload';
import { createRecorder, type RecorderController } from '../recording/clientRecorder';
import { finalizeWebmDuration } from '../recording/webmFinalize';
import { deleteReplayRecovery, saveFinalizedReplay, saveReplayChunk } from '../recording/replayRecovery';
import { useLiveSession } from '../useLiveSession';
import { useLiveRtc } from '../hooks/useLiveRtc';
import { LiveChatPanel } from '../components/LiveChatPanel';
import { FloatingReactions } from '../components/FloatingReactions';

type BootState = 'idle' | 'auth' | 'creating' | 'loading' | 'starting' | 'ready' | 'error';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function toUserError(error: unknown): string {
  const anyErr = error as { message?: unknown; name?: unknown };
  const message = String(anyErr?.message || '');
  const name = String(anyErr?.name || '');
  if (name === 'NotAllowedError') return 'Ban chua cap quyen camera/micro.';
  if (name === 'NotFoundError') return 'Khong tim thay thiet bi camera/micro.';
  if (message.toLowerCase().includes('timeout')) return 'Ket noi qua cham, vui long thu lai.';
  return message || 'Khong the bat dau phat truc tiep.';
}

const REC_BADGE: Partial<Record<RecordingStatus, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }>> = {
  idle: { label: 'âº Sáºµn sĂ ng', variant: 'secondary' },
  acquiring: { label: 'â³ Äang chuáº©n bá»‹...', variant: 'secondary' },
  starting: { label: 'â³ Äang báº¯t Ä‘áº§u...', variant: 'secondary' },
  recording: { label: 'âº Äang ghi', variant: 'destructive' },
  stopping: { label: 'â³ Äang dá»«ng...', variant: 'secondary' },
  processing: { label: 'â³ Äang xá»­ lĂ½...', variant: 'secondary' },
  ready: { label: 'âœ“ ÄĂ£ lÆ°u', variant: 'default' },
  failed: { label: 'âœ— Lá»—i ghi hĂ¬nh', variant: 'outline' },
  stopped: { label: 'â–  ÄĂ£ dá»«ng', variant: 'secondary' },
};

export default function LiveHostPage() {
  const navigate = useNavigate();
  const { liveSessionId } = useParams<{ liveSessionId: string }>();

  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [bootState, setBootState] = useState<BootState>('idle');
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [recordingState, setRecordingState] = useState<RecordingStatus>('idle');
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [activeReplayId, setActiveReplayId] = useState<string | null>(null);
  const [replayStatus, setReplayStatus] = useState<LiveReplayStatus | null>(null);
  const startedRef = useRef(false);
  const browserRecorderRef = useRef<RecorderController | null>(null);
  const lastSentViewerCountRef = useRef<number | null>(null);
  const viewerCountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveSessionId = liveSessionId || createdSessionId || undefined;
  const sessionQuery = useLiveSession(effectiveSessionId);
  const session = sessionQuery.data;

  const {
    setLocalContainerRef,
    isJoined,
    isMuted,
    isCameraOff,
    statusText,
    start,
    leave,
    toggleMute,
    toggleCamera,
    getLocalTracks,
  } = useLiveRtc({
    sessionId: effectiveSessionId,
    role: 'host',
    enabled: !!effectiveSessionId && session?.status !== 'ended',
    onViewerCountChange: async (count) => {
      if (!effectiveSessionId) return;
      if (lastSentViewerCountRef.current === count) return;
      if (viewerCountTimerRef.current) {
        clearTimeout(viewerCountTimerRef.current);
      }
      viewerCountTimerRef.current = setTimeout(async () => {
        if (!effectiveSessionId) return;
        if (lastSentViewerCountRef.current === count) return;
        lastSentViewerCountRef.current = count;
        await updateLiveViewerCount(effectiveSessionId, count);
      }, 400);
    },
  });

  const isHost = useMemo(() => !!session && !!userId && session.host_user_id === userId, [session, userId]);

  const runBootstrap = useCallback(async () => {
    setBootError(null);
    setBootState('auth');
    setCreatedSessionId(null);

    const authResult = await withTimeout(supabase.auth.getSession(), 8000, 'auth timeout');
    const currentUserId = authResult.data.session?.user?.id;
    if (!currentUserId) {
      throw new Error('Ban can dang nhap de phat truc tiep.');
    }
    setUserId(currentUserId);

    if (liveSessionId) {
      setBootState('loading');
      return;
    }

    setBootState('creating');
    const created = await withTimeout(
      createLiveSession({ privacy: 'public' }),
      15000,
      'create live session timeout'
    );
    setCreatedSessionId(created.id);
    setBootState('loading');
    navigate(`/live/${created.id}/host`, { replace: true });
  }, [liveSessionId, navigate]);

  useEffect(() => {
    let active = true;
    runBootstrap().catch((error) => {
      if (!active) return;
      setBootState('error');
      setBootError(toUserError(error));
    });

    return () => {
      active = false;
    };
  }, [retryNonce, runBootstrap]);

  useEffect(() => {
    if (typeof session?.viewer_count === 'number') {
      lastSentViewerCountRef.current = session.viewer_count;
    }
  }, [session?.viewer_count]);

  useEffect(() => {
    if (!effectiveSessionId) return;
    if (sessionQuery.isLoading) return;
    if (sessionQuery.isError) {
      setBootState('error');
      setBootError('Khong tai duoc phien LIVE. Vui long thu lai.');
      return;
    }
    if (!session) {
      setBootState('error');
      setBootError('Khong tim thay phien LIVE.');
      return;
    }
    if (bootState !== 'starting') {
      setBootState('ready');
    }
  }, [bootState, effectiveSessionId, session, sessionQuery.isError, sessionQuery.isLoading]);

  // Start Agora RTC + Browser Recording
  useEffect(() => {
    if (!session || !isHost || session.status === 'ended' || startedRef.current) return;
    startedRef.current = true;
    setBootState('starting');

    start()
      .then(() => {
        setBootState('ready');

        // Start browser recording immediately after joining
        try {
          const tracks = getLocalTracks();
          if (tracks.video && tracks.audio) {
            const stream = new MediaStream();
            const videoTrack = tracks.video.getMediaStreamTrack();
            const audioTrack = tracks.audio.getMediaStreamTrack();
            if (videoTrack) stream.addTrack(videoTrack);
            if (audioTrack) stream.addTrack(audioTrack);
            const recorder = createRecorder(stream, {
              onChunk: (chunk, sequence) => {
                if (!effectiveSessionId) return;
                saveReplayChunk(effectiveSessionId, sequence, chunk).catch(() => undefined);
              },
            });
            recorder.start();
            browserRecorderRef.current = recorder;
            setRecordingState('recording');
            setRecordingError(null);
          } else {
            setRecordingState('failed');
            setRecordingError('KhĂ´ng láº¥y Ä‘Æ°á»£c track video/audio Ä‘á»ƒ ghi hĂ¬nh.');
          }
        } catch (recErr: unknown) {
          const message = recErr instanceof Error ? recErr.message : '';
          setRecordingState('failed');
          setRecordingError(message || 'Khong the bat dau ghi hinh.');
          toast.error('KhĂ´ng thá»ƒ báº¯t Ä‘áº§u ghi hĂ¬nh báº±ng trĂ¬nh duyá»‡t.');
        }
      })
      .catch((error) => {
        startedRef.current = false;
        const message = toUserError(error);
        setBootState('error');
        setBootError(message);
        toast.error(message);
      });
  }, [effectiveSessionId, isHost, session, start, getLocalTracks]);

  useEffect(() => {
    if (session?.status === 'ended') {
      leave().catch(() => undefined);
    }
  }, [leave, session?.status]);

  useEffect(() => {
    if (!activeReplayId) return;
    const channel = supabase
      .channel(`live-replay-${activeReplayId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_replays', filter: `id=eq.${activeReplayId}` },
        (payload: { new: LiveReplayRow }) => {
          const next = payload.new;
          setReplayStatus(next.status);
          if (next.status === 'ready') {
            setRecordingState('ready');
            if (effectiveSessionId) deleteReplayRecovery(effectiveSessionId).catch(() => undefined);
          }
          if (next.status === 'failed') {
            setRecordingState('failed');
            setRecordingError(next.error_message || 'Cloudflare Stream processing failed.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeReplayId, effectiveSessionId]);

  useEffect(() => {
    return () => {
      if (viewerCountTimerRef.current) {
        clearTimeout(viewerCountTimerRef.current);
      }
      leave().catch(() => undefined);
    };
  }, [leave]);

const handleEndLive = async () => {
    if (!effectiveSessionId) return;
    if (viewerCountTimerRef.current) {
      clearTimeout(viewerCountTimerRef.current);
      viewerCountTimerRef.current = null;
    }

    let recordingStatus: RecordingStatus = 'failed';

    try {
      if (browserRecorderRef.current?.getState() === 'recording') {
        setRecordingState('stopping');
        const blob = await browserRecorderRef.current.stop();
        if (blob.size > 0) {
          setRecordingState('processing');
          setUploadProgress(0);

          const finalized = await finalizeWebmDuration(blob);
          await saveFinalizedReplay({
            sessionId: effectiveSessionId,
            blob: finalized.blob,
            mimeType: finalized.blob.type || browserRecorderRef.current.getMimeType(),
            size: finalized.blob.size,
            durationSeconds: finalized.durationSeconds,
          });

          const upload = await createLiveReplayUpload({
            liveSessionId: effectiveSessionId,
            expectedSize: finalized.blob.size,
          });
          setActiveReplayId(upload.replay_id);
          setReplayStatus('uploading');
          setRecordingState('uploading');

          await saveFinalizedReplay({
            sessionId: effectiveSessionId,
            blob: finalized.blob,
            mimeType: finalized.blob.type || browserRecorderRef.current.getMimeType(),
            size: finalized.blob.size,
            durationSeconds: finalized.durationSeconds,
            replayId: upload.replay_id,
          });

          await uploadReplayToCloudflare({
            blob: finalized.blob,
            uploadURL: upload.uploadURL,
            method: upload.upload_method,
            filename: `fun-live-replay-${effectiveSessionId}.webm`,
            onProgress: (percent) => setUploadProgress(percent),
          });

          await markLiveReplayUploaded(upload.replay_id);
          setReplayStatus('queued');
          setRecordingState('processing');
          recordingStatus = 'processing';
        } else {
          setRecordingState('failed');
          setRecordingError('Video trá»‘ng, khĂ´ng thá»ƒ lÆ°u replay.');
        }
      } else {
        setRecordingState('failed');
        setRecordingError('KhĂ´ng cĂ³ báº£n ghi nĂ o Ä‘ang hoáº¡t Ä‘á»™ng.');
      }

      await finalizeLiveSession(effectiveSessionId, { playbackUrl: null, recordingStatus });

      await leave();
      toast.success('Live Ä‘Ă£ káº¿t thĂºc!');
      navigate(`/live/${effectiveSessionId}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Khong the ket thuc live');
    }
  };

  const handleRetry = () => {
    startedRef.current = false;
    setBootError(null);
    setBootState('idle');
    setRetryNonce((x) => x + 1);
  };

  const isEnding = ['stopping', 'uploading', 'queued', 'processing'].includes(recordingState);

  const showLoader =
    ['auth', 'creating', 'loading', 'starting'].includes(bootState) ||
    (!!effectiveSessionId && sessionQuery.isLoading);

  if (showLoader) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>
            {bootState === 'creating'
              ? 'Dang tao phien LIVE...'
              : bootState === 'starting'
                ? 'Dang ket noi Agora...'
                : 'Dang tai...'}
          </span>
        </div>
      </div>
    );
  }

  if (bootState === 'error') {
    return (
      <div className="min-h-screen bg-background">
        <FacebookNavbar />
        <div className="pt-20 px-4 max-w-xl mx-auto">
          <Card className="p-6 space-y-4">
            <div className="font-semibold text-lg">Khong the bat dau LIVE</div>
            <div className="text-sm text-muted-foreground">{bootError || 'Da xay ra loi khong xac dinh.'}</div>
            <div className="flex items-center gap-2">
              <Button onClick={handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Thu lai
              </Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                <Home className="h-4 w-4 mr-2" />
                Quay ve trang chu
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6 space-y-3">
          <div>Live session not found.</div>
          <Button onClick={handleRetry}>Retry</Button>
        </Card>
      </div>
    );
  }

  if (!isHost) {
    return (
      <div className="min-h-screen bg-background">
        <FacebookNavbar />
        <div className="pt-20 px-4 max-w-3xl mx-auto">
          <Card className="p-6 text-center space-y-4">
            <p className="font-semibold">You are not the host of this live session.</p>
            <Button onClick={() => navigate(`/live/${session.id}`)}>Switch to viewer mode</Button>
          </Card>
        </div>
      </div>
    );
  }

  const recBadge = REC_BADGE[recordingState] || { label: recordingState.toUpperCase(), variant: 'secondary' as const };

  return (
    <div className="min-h-screen bg-background">
      <FacebookNavbar />
      <main className="pt-16 px-3 md:px-6 pb-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <h1 className="text-xl md:text-2xl font-bold">{session.title || 'Live Stream'}</h1>
                <div className="text-sm text-muted-foreground">Channel: {session.agora_channel || session.channel_name}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={session.status === 'live' && isJoined ? 'destructive' : 'secondary'} className="gap-1">
                  <Radio className="h-3.5 w-3.5" />
                  {session.status === 'ended' ? 'ENDED' : isJoined ? 'LIVE' : 'CONNECTING'}
                </Badge>
                <Badge variant={recBadge.variant}>
                  {recBadge.label}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {session.viewer_count || 0}
                </Badge>
              </div>
            </div>

            {recordingError ? (
              <Card className="p-3 text-sm border-destructive/30 text-destructive">
                Ghi hĂ¬nh: {recordingError}
              </Card>
            ) : null}


            {recordingState === 'stopping' && (
              <Card className="p-3 text-sm border-primary/30 text-primary flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Äang dá»«ng ghi hĂ¬nh...
              </Card>
            )}

            {['uploading', 'queued', 'processing'].includes(recordingState) && (
              <Card className="p-4 border-primary/30">
                <div className="flex items-center gap-2 mb-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium text-primary">
                    Äang táº£i video lĂªn...
                  </span>
                  <span className="ml-auto text-sm font-mono font-bold text-primary">
                    {uploadProgress}%
                  </span>
                </div>
                <Progress value={uploadProgress} className="h-2.5" />
                <p className="text-xs text-muted-foreground mt-2">
                  â ï¸ Vui lĂ²ng khĂ´ng Ä‘Ă³ng tab â€” video sáº½ bá»‹ máº¥t náº¿u thoĂ¡t trang
                </p>
              </Card>
            )}


            <Card className="overflow-hidden">
              <div className="aspect-video bg-black relative">
                <div ref={setLocalContainerRef} className="h-full w-full" />
                {!isJoined && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/90 bg-black/50">
                    {statusText}
                  </div>
                )}
                {effectiveSessionId && <FloatingReactions sessionId={effectiveSessionId} />}
              </div>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={toggleMute} disabled={!isJoined || isEnding}>
                {isMuted ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>
              <Button variant="outline" onClick={toggleCamera} disabled={!isJoined || isEnding}>
                {isCameraOff ? <VideoOff className="h-4 w-4 mr-2" /> : <Video className="h-4 w-4 mr-2" />}
                {isCameraOff ? 'Camera On' : 'Camera Off'}
              </Button>
              <Button variant="destructive" onClick={handleEndLive} disabled={isEnding}>
                {isEnding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PhoneOff className="h-4 w-4 mr-2" />}
                {isEnding ? 'Äang xá»­ lĂ½...' : 'End Live'}
              </Button>
            </div>
          </section>

          {effectiveSessionId && <LiveChatPanel sessionId={effectiveSessionId} className="h-[70vh] lg:h-[calc(100vh-120px)]" />}
        </div>
      </main>
    </div>
  );
}

```

---

### FILE: src/modules/feed/components/post/LivePostCard.tsx

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Eye, Video, CameraOff, Radio } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StreamPlayer } from '@/components/ui/StreamPlayer';
import { ReplayPlayer } from '@/modules/live/components/ReplayPlayer';
import { LiveChatReplay } from '@/modules/live/components/LiveChatReplay';
import { cn } from '@/lib/utils';

interface LivePostCardProps {
  liveMetadata: Record<string, unknown>;
  videoUrl?: string | null;
  liveStatus: 'live' | 'ended';
  liveSessionId: string | null;
  postContent: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function LivePostCard({ liveMetadata, videoUrl, liveStatus, liveSessionId, postContent }: LivePostCardProps) {
  const navigate = useNavigate();
  const [playerOpen, setPlayerOpen] = useState(false);

  const title = liveMetadata.live_title || postContent || 'PhĂ¡t trá»±c tiáº¿p trĂªn FUN Profile';
  const viewerCount = Number(liveMetadata.viewer_count || 0);
  const thumbnailUrl = liveMetadata.thumbnail_url || null;
  const durationSeconds = liveMetadata.duration_seconds ? Number(liveMetadata.duration_seconds) : null;
  const endedAt = liveMetadata.ended_at || null;
  const replayStatus = liveMetadata.replay_status || liveMetadata.recording_status || null;
  const playbackType = liveMetadata.playback_type || (liveMetadata.playback_hls ? 'cloudflare_stream' : 'chunked');

  // Prefer production Cloudflare Stream HLS, fall back to legacy R2/WebM replay.
  const playbackUrl = liveMetadata.playback_hls || liveMetadata.playback_url || videoUrl || null;
  const hasVideo = !!playbackUrl;

  // Currently LIVE
  if (liveStatus === 'live') {
    const handleGoLive = () => {
      if (liveSessionId) navigate(`/live/${liveSessionId}`);
    };

    return (
      <div className="mb-3 overflow-hidden">
        {/* Preview area */}
        <button
          onClick={handleGoLive}
          className="relative w-full block group focus:outline-none"
          aria-label="Xem trá»±c tiáº¿p"
        >
          <div className="w-full aspect-video relative overflow-hidden bg-black">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={title}
                className="w-full h-full object-cover opacity-90 group-hover:opacity-80 transition-opacity"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-gray-900 to-red-900">
                <div
                  className="absolute inset-0 opacity-40 animate-pulse"
                  style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, hsl(0 80% 40% / 0.7) 0%, transparent 60%), radial-gradient(circle at 70% 70%, hsl(0 60% 25% / 0.6) 0%, transparent 55%)' }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-red-600/40 border-2 border-red-500/50 flex items-center justify-center backdrop-blur-sm animate-pulse">
                    <Radio className="w-8 h-8 text-red-300" />
                  </div>
                  <div className="text-center px-8">
                    <p className="text-white font-semibold text-sm line-clamp-2 drop-shadow">{title}</p>
                    <p className="text-white/50 text-xs mt-1">Äang phĂ¡t trá»±c tiáº¿p</p>
                  </div>
                </div>
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

            {/* ÄANG LIVE badge - top left */}
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                ÄANG LIVE
              </span>
            </div>

            {/* Viewer count - top right */}
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center gap-1 bg-black/70 text-white text-[11px] px-2 py-0.5 rounded">
                <Eye className="w-3 h-3" />
                {viewerCount}
              </span>
            </div>

            {/* Big play button - center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/90 shadow-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <Play className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" />
              </div>
            </div>
          </div>
        </button>

        {/* Info bar below */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-border bg-card">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{title}</p>
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <Eye className="w-3 h-3" />
              <span>{viewerCount} ngÆ°á»i Ä‘ang xem</span>
            </div>
          </div>
          {liveSessionId && (
            <Button size="sm" variant="destructive" className="ml-3 shrink-0" onClick={handleGoLive}>
              <Radio className="w-3.5 h-3.5 mr-1" />
              Xem LIVE
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (liveStatus === 'ended' && !hasVideo && ['uploading', 'queued', 'processing'].includes(String(replayStatus))) {
    return (
      <div className="mx-4 mb-3 rounded-xl border border-border overflow-hidden bg-card">
        <div className="px-4 py-5 flex items-center gap-3 text-muted-foreground">
          <Radio className="w-8 h-8 shrink-0 opacity-60 animate-pulse" />
          <div>
            <p className="text-sm font-medium text-foreground">Replay is processing</p>
            <p className="text-xs mt-0.5">Cloudflare Stream is preparing HLS playback.</p>
          </div>
          <span className="ml-auto shrink-0 inline-flex items-center bg-muted text-muted-foreground text-[11px] font-bold px-2 py-0.5 rounded">
            PROCESSING
          </span>
        </div>
      </div>
    );
  }

  // ENDED - No video available
  if (!hasVideo) {
    return (
      <div className="mx-4 mb-3 rounded-xl border border-border overflow-hidden bg-card">
        <div className="px-4 py-5 flex items-center gap-3 text-muted-foreground">
          <CameraOff className="w-8 h-8 shrink-0 opacity-50" />
          <div>
            <p className="text-sm font-medium text-foreground">PhiĂªn live Ä‘Ă£ káº¿t thĂºc</p>
            <p className="text-xs mt-0.5">Video replay chÆ°a Ä‘Æ°á»£c lÆ°u cho phiĂªn nĂ y</p>
          </div>
          {liveSessionId && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto shrink-0"
              onClick={() => navigate(`/live/${liveSessionId}`)}
            >
              Xem thĂ´ng tin
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ENDED - Has video replay
  return (
    <>
      <div className="mb-3 overflow-hidden">
        {/* Thumbnail / Preview area */}
        <button
          onClick={() => setPlayerOpen(true)}
          className="relative w-full block group focus:outline-none"
          aria-label="Xem láº¡i video"
        >
          {/* Background */}
          <div
            className={cn(
              'w-full aspect-video relative overflow-hidden',
              'bg-black'
            )}
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={title}
                className="w-full h-full object-cover opacity-90 group-hover:opacity-80 transition-opacity"
              />
            ) : (
              /* Beautiful gradient fallback when no thumbnail */
              <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-gray-900 to-purple-950">
                <div className="absolute inset-0 opacity-30"
                  style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, hsl(0 80% 40% / 0.6) 0%, transparent 60%), radial-gradient(circle at 70% 70%, hsl(270 60% 30% / 0.5) 0%, transparent 55%)' }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-red-600/30 border-2 border-red-500/40 flex items-center justify-center backdrop-blur-sm">
                    <Radio className="w-8 h-8 text-red-300" />
                  </div>
                  <div className="text-center px-8">
                    <p className="text-white font-semibold text-sm line-clamp-2 drop-shadow">{title}</p>
                    <p className="text-white/50 text-xs mt-1">Video Replay</p>
                  </div>
                </div>
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

            {/* VIDEO REPLAY badge - top left */}
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded">
                <Video className="w-3 h-3" />
                {playbackType === 'cloudflare_stream' ? 'REPLAY' : 'VIDEO REPLAY'}
              </span>
            </div>

            {/* Duration badge - top right */}
            {durationSeconds !== null && (
              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center bg-black/70 text-white text-[11px] font-mono px-2 py-0.5 rounded">
                  {formatDuration(durationSeconds)}
                </span>
              </div>
            )}

            {/* Big play button - center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/90 shadow-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <Play className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" />
              </div>
            </div>

          </div>
        </button>

        {/* Info bar below */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-border bg-card">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{title}</p>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {viewerCount} ngÆ°á»i xem
              </span>
              {endedAt && (
                <>
                  <span>Â·</span>
                  <span>
                    ÄĂ£ káº¿t thĂºc{' '}
                    {formatDistanceToNow(new Date(endedAt), { addSuffix: true, locale: vi })}
                  </span>
                </>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="default"
            className="ml-3 shrink-0"
            onClick={() => setPlayerOpen(true)}
          >
            <Play className="w-3.5 h-3.5 mr-1" />
            Xem láº¡i
          </Button>
        </div>
      </div>

      {/* Dialog player */}
      <Dialog open={playerOpen} onOpenChange={setPlayerOpen}>
        <DialogContent className="max-w-5xl w-full p-0 overflow-hidden bg-black border-border">
          <DialogHeader className="px-4 py-3 bg-card/90 border-b border-border">
            <DialogTitle className="text-sm font-semibold truncate pr-8">{title}</DialogTitle>
          </DialogHeader>
          <div className={cn(
            'flex flex-col',
            liveSessionId ? 'md:flex-row' : ''
          )}>
            {/* Video */}
            <div className={cn(
              'w-full bg-black',
              liveSessionId ? 'md:flex-[3]' : '',
              'aspect-video'
            )}>
              {playbackType === 'cloudflare_stream' ? (
                <ReplayPlayer
                  src={playbackUrl}
                  poster={thumbnailUrl || undefined}
                  className="w-full h-full"
                  autoPlay
                  muted={false}
                />
              ) : (
                <StreamPlayer
                  src={playbackUrl}
                  poster={thumbnailUrl || undefined}
                  className="w-full h-full"
                  autoPlay
                  muted={false}
                  enableStatusCheck={false}
                />
              )}
            </div>
            {/* Chat Replay */}
            {liveSessionId && (
              <div className="md:flex-[2] border-t md:border-t-0 md:border-l border-border h-72 md:h-auto md:max-h-[60vh]">
                <LiveChatReplay sessionId={liveSessionId} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

```

---

### FILE: src/modules/live/liveService.ts

```ts
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
  source?: string | null;
  live_mode?: string | null;
  stream_provider?: string | null;
  stream_key?: string | null;
  rtmp_status?: string | null;
  rtmp_started_at?: string | null;
  rtmp_ended_at?: string | null;
  hls_url?: string | null;
  hls_playback_url?: string | null;
  agora_uid_host?: number | null;
  recording_uid?: number | null;
  recording_status?: LiveSession['recording_status'];
  title?: string | null;
  privacy: LiveSession['privacy'];
  status: LiveSession['status'];
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

function normalizeLiveSession(row: any): LiveSession {
  return {
    id: row.id,
    host_user_id: row.host_user_id || row.owner_id,
    agora_channel: row.agora_channel || row.channel_name,
    channel_name: row.channel_name,
    source: row.source || 'agora',
    live_mode: row.live_mode || (row.source === 'rtmp' ? 'rtmp' : 'webcam'),
    stream_provider: row.stream_provider || (row.source === 'rtmp' ? 'nginx_rtmp' : 'agora'),
    stream_key: row.stream_key ?? null,
    rtmp_status: row.rtmp_status ?? null,
    rtmp_started_at: row.rtmp_started_at ?? null,
    rtmp_ended_at: row.rtmp_ended_at ?? null,
    hls_url: row.hls_url ?? null,
    hls_playback_url: row.hls_playback_url ?? null,
    agora_uid_host: row.agora_uid_host ?? null,
    recording_uid: row.recording_uid ?? null,
    recording_status: row.recording_status ?? null,
    title: row.title ?? null,
    privacy: row.privacy,
    status: row.status,
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
        id, host_user_id, agora_channel, channel_name, source, live_mode, stream_provider, rtmp_status,
        rtmp_started_at, rtmp_ended_at, hls_url, hls_playback_url, title, privacy, status, viewer_count,
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
      id, host_user_id, agora_channel, channel_name, source, live_mode, stream_provider, rtmp_status,
      rtmp_started_at, rtmp_ended_at, hls_url, hls_playback_url, recording_uid, title, privacy, status, viewer_count,
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
      id, host_user_id, agora_channel, channel_name, source, live_mode, stream_provider, rtmp_status,
      rtmp_started_at, rtmp_ended_at, hls_url, hls_playback_url, title, privacy, status, viewer_count,
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

export async function finalizeLiveSession(
  sessionId: string,
  options: FinalizeLiveSessionOptions = {}
): Promise<void> {
  const { playbackUrl = null, recordingStatus = playbackUrl ? 'ready' : 'failed' } = options;
  const nowIso = new Date().toISOString();

  const { data, error } = await db
    .from('live_sessions')
    .update({
      status: 'ended',
      ended_at: nowIso,
      recording_status: recordingStatus,
      updated_at: nowIso,
    })
    .eq('id', sessionId)
    .select('id, post_id, title, agora_channel, channel_name, ended_at')
    .single();

  if (error) throw error;

  if (data?.post_id) {
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

```

---

### FILE: src/modules/live/types.ts

```ts
export type LivePrivacy = 'public' | 'friends';
export type LiveStatus = 'live' | 'ended';
export type LiveSource = 'agora' | 'rtmp';
export type LiveMode = 'webcam' | 'rtmp';
export type StreamProvider = 'agora' | 'nginx_rtmp';
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
  live_mode?: LiveMode;
  stream_provider?: StreamProvider;
  stream_key?: string | null;
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
    | null;
  title: string | null;
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

```

## Integration Checklist

1. Install dependencies:

```bash
npm install ts-ebml buffer
```

2. Apply the migration:

```bash
supabase db push
```

3. Deploy Edge Functions:

```bash
supabase functions deploy live-replay-create-upload
supabase functions deploy stream-webhook
```

4. Set Cloudflare Stream webhook URL to `/functions/v1/stream-webhook`.

5. Set required secrets listed above.

6. Verify with a live session:

- Start Agora webcam live.
- End live.
- Browser finalizes WebM duration with `ts-ebml`.
- Browser uploads directly to Cloudflare Stream.
- `live_replays.status` moves `uploading -> queued/processing -> ready`.
- `posts.video_url` and metadata use Cloudflare HLS.
- Replay plays through `ReplayPlayer` on Safari native HLS or `hls.js`.

## Acceptance Criteria

- New livestream replays use Cloudflare Stream HLS, not WebM chunk stitching.
- Legacy replay URLs still work through the old fallback player.
- iPhone/iPad/Safari can load, seek, and display correct duration.
- Webhook updates `live_replays`, `live_sessions.recording_status`, and linked post metadata.
- Failed Cloudflare processing is reflected as `live_replays.status = failed`.
