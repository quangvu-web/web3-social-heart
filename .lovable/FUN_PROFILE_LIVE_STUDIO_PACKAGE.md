# Fun Profile Live Studio Package

Ngay tao: 2026-05-09
Pham vi: Dual-mode livestream cho Fun Profile, gom Webcam Live bang Agora RTC va OBS/RTMP Live bang Cloudflare Stream Live Input, dung chung replay archive pipeline sang Cloudflare R2.

## Ten tinh nang

**Fun Profile Live Studio**

Ten ky thuat: **Dual-Mode Livestream + Replay Archive Pipeline**

## Muc tieu

Fun Profile co 2 che do live:

1. **Webcam Live trong app**
   - Host live bang camera/micro tren browser/mobile.
   - Agora RTC xu ly realtime.
   - Phu hop live nhanh, do tre thap.

2. **OBS/RTMP Live**
   - Creator dung OBS/Streamlabs/XSplit hoac RTMP encoder.
   - Backend tao Cloudflare Stream Live Input rieng cho moi phien.
   - Creator nhan RTMPS URL + Stream Key.
   - OBS live doc lap browser tab: dong tab/refresh/logout/chuyen trang van live neu OBS con stream.
   - Trang thai live dua vao Cloudflare webhook/events, khong dua vao browser state.

Sau khi bat ky livestream nao ket thuc:

1. Cloudflare Stream video READY.
2. Tao/lay MP4 downloadable file.
3. Download MP4 tu Cloudflare Stream.
4. Upload MP4 sang Cloudflare R2.
5. Verify object ton tai trong R2.
6. Update DB storage_provider = r2, playback_provider = r2.
7. Tao/update replay feed post.
8. Upsert creator library.
9. Chi sau khi cac buoc tren thanh cong moi xoa video Cloudflare Stream.
10. Replay/feed phat video tu R2, khong dung Cloudflare Stream lau dai.

## Audit file lien quan

### Frontend Agora Webcam Live

- src/modules/live/hooks/useLiveRtc.ts
  - Dung gora-rtc-sdk-ng.
  - Host tao local audio/video track bang AgoraRTC.createMicrophoneAndCameraTracks().
  - Publish camera/mic len Agora RTC.
  - Viewer subscribe remote tracks.
  - Co mute/unmute, camera on/off, token renew/rejoin.

- src/modules/live/pages/LiveHostPage.tsx
  - Host page cho Webcam Live.
  - Tao live session, join Agora, bat dau browser recording replay.
  - End live se dung recorder/background uploader hien co.

- src/modules/live/pages/LiveAudiencePage.tsx
  - Viewer page cho Agora va RTMP.
  - Neu RTMP thi play HLS bang RTMPPlayer.
  - Neu replay san sang thi play R2 MP4/replay URL.

- src/modules/live/liveService.ts
  - Tao session Webcam Live.
  - Update viewer count, finalize session, attach replay metadata.

### Frontend OBS/RTMP Live

- src/modules/live/components/StartLiveDialog.tsx
  - UI co 2 lua chon chinh: Webcam va Live bang OBS.
  - OBS route: /live/rtmp/new.

- src/modules/live/pages/RtmpHostPage.tsx
  - Control panel OBS.
  - Hien RTMPS URL + Stream Key.
  - Copy server, copy key, reset stream key, end live.
  - Poll/realtime subscribe status DB.
  - Tab chi la control panel, OBS stream doc lap.

- src/modules/live/rtmpService.ts
  - Goi Edge Function live-rtmp voi cac action: create, status, host-session, end, copy-stream-key, reset-stream-key.

### Backend / Supabase Edge Functions

- supabase/functions/live-rtmp/index.ts
  - createRtmpLiveSession: verify auth, tao Cloudflare Live Input, encrypt stream key, insert live_sessions mode tmp_obs, status waiting_for_obs.
  - getRtmpLiveSessionCredentials: chi owner xem/copy key.
  - endRtmpLiveSession: owner end, disable live input, khong xoa recording truoc archive.
  - esetRtmpStreamKey: disable old live input, tao live input moi, encrypt key moi.

- supabase/functions/stream-webhook/index.ts
  - Verify Cloudflare webhook signature.
  - Xu ly live input connected/disconnected.
  - Tao live feed post khi OBS connected.
  - Khi video ready thi tao/update live_replays, update live_sessions, trigger rchiveReplayToR2.

- supabase/functions/_shared/archiveReplay.ts
  - Archive pipeline dung chung cho Cloudflare Stream replay cua live.
  - Tao/lay MP4 download.
  - Upload MP4 sang R2.
  - Verify R2 object.
  - Update live_replays/live_sessions/posts/creator_library.
  - Delete Cloudflare Stream chi sau khi R2 + DB + post + creator library thanh cong.
  - Idempotent voi case da archive R2 nhung chua delete Stream.

- supabase/functions/retry-archive-replays/index.ts
  - Retry archive cac status pending/mp4_pending/failed/stream_delete_pending.

- supabase/functions/delete-post/index.ts
  - Soft delete post.
  - Build delete metadata.
  - Xoa R2 object va Cloudflare Stream UID neu con.
  - Mark live_replays/live_recordings/live_sessions/creator_library deleted.

- supabase/functions/_shared/postVideoDelete.ts
  - Extract Stream UID/R2 key tu post metadata, URLs, live_sessions, live_replays, live_recordings.
  - Delete Cloudflare Stream va R2 bang server-side secrets.

### Database migrations lien quan da co

- supabase/migrations/20260211103000_live_sessions_mvp.sql
- supabase/migrations/20260215010000_live_stream_mvp_phase0.sql
- supabase/migrations/20260429160000_rtmp_livestream_support.sql
- supabase/migrations/20260504071500_live_replays_cloudflare_stream.sql
- supabase/migrations/20260507120000_post_video_delete_soft_cleanup.sql
- supabase/migrations/20260507133000_live_replay_archive_to_r2.sql
- supabase/migrations/20260508103000_cloudflare_stream_obs_live_input.sql
- supabase/migrations/20260509120000_livestream_dual_mode_archive_hardening.sql

## Migration moi can them

File: supabase/migrations/20260509120000_livestream_dual_mode_archive_hardening.sql

`sql
-- Dual-mode livestream hardening.
-- Backward compatible with existing Agora rows (`mode = 'agora'`) while new
-- webcam sessions write the explicit `agora_webcam` mode requested by the app.

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS agora_channel_name text,
  ADD COLUMN IF NOT EXISTS agora_uid bigint,
  ADD COLUMN IF NOT EXISTS playback_url text,
  ADD COLUMN IF NOT EXISTS rtmps_url text,
  ADD COLUMN IF NOT EXISTS stream_key_encrypted text,
  ADD COLUMN IF NOT EXISTS cloudflare_mp4_download_url text,
  ADD COLUMN IF NOT EXISTS r2_object_key text,
  ADD COLUMN IF NOT EXISTS r2_bucket text,
  ADD COLUMN IF NOT EXISTS r2_video_url text,
  ADD COLUMN IF NOT EXISTS storage_provider text,
  ADD COLUMN IF NOT EXISTS playback_provider text,
  ADD COLUMN IF NOT EXISTS archive_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS archive_error text,
  ADD COLUMN IF NOT EXISTS recording_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS stream_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.live_sessions
SET
  agora_channel_name = COALESCE(agora_channel_name, agora_channel, channel_name),
  agora_uid = COALESCE(agora_uid, agora_uid_host::bigint)
WHERE source = 'agora' OR stream_provider = 'agora';

UPDATE public.live_sessions
SET mode = 'agora_webcam'
WHERE COALESCE(mode, 'agora') = 'agora'
  AND COALESCE(source, 'agora') = 'agora';

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_status_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_status_check
  CHECK (status IN ('created', 'waiting_for_obs', 'live', 'ended', 'processing', 'archiving', 'posted', 'failed'));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_mode_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_mode_check
  CHECK (mode IN ('agora', 'agora_webcam', 'rtmp_obs'));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_archive_status_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_archive_status_check
  CHECK (archive_status IN ('pending', 'ready', 'mp4_pending', 'archiving', 'archived', 'posting', 'posted', 'stream_delete_pending', 'failed'));

ALTER TABLE public.live_replays
  DROP CONSTRAINT IF EXISTS live_replays_archive_status_check;

ALTER TABLE public.live_replays
  ADD CONSTRAINT live_replays_archive_status_check
  CHECK (archive_status IN ('pending', 'ready', 'mp4_pending', 'archiving', 'archived', 'posting', 'posted', 'stream_delete_pending', 'failed'));

CREATE INDEX IF NOT EXISTS idx_live_sessions_archive_status_retry
  ON public.live_sessions(archive_status, updated_at ASC)
  WHERE stream_deleted_at IS NULL AND archive_status IN ('pending', 'ready', 'mp4_pending', 'failed', 'stream_delete_pending');

CREATE INDEX IF NOT EXISTS idx_live_replays_archive_status_retry_v2
  ON public.live_replays(next_archive_retry_at ASC, updated_at ASC)
  WHERE stream_deleted_at IS NULL AND archive_status IN ('pending', 'ready', 'mp4_pending', 'failed', 'stream_delete_pending');

CREATE INDEX IF NOT EXISTS idx_live_sessions_mode_status
  ON public.live_sessions(mode, status, created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.live_sessions.mode IS
  'Livestream mode. New values: agora_webcam for in-app Agora RTC webcam live, rtmp_obs for Cloudflare Stream Live Input/OBS. Legacy agora is accepted for old rows.';

`

## Luong hoat dong

### Webcam Live

`	ext
User webcam/mic
-> Agora RTC realtime
-> Browser/Cloudflare Stream replay processing hien co
-> Cloudflare Stream video READY
-> archiveReplayToR2
-> Export/download MP4
-> Upload MP4 sang R2
-> Verify R2 object
-> Create/update replay feed post
-> Upsert creator_library
-> Delete Cloudflare Stream video
-> Feed replay phat R2 MP4
`

### OBS/RTMP Live

`	ext
OBS/RTMP encoder
-> Cloudflare Stream Live Input
-> Cloudflare webhook connected
-> live_sessions.status = live
-> Cloudflare recording/transcoding
-> Cloudflare webhook disconnected/video READY
-> live_sessions.status = ended/processing
-> archiveReplayToR2
-> Export/download MP4
-> Upload MP4 sang R2
-> Verify R2 object
-> Create/update replay feed post
-> Upsert creator_library
-> Delete Cloudflare Stream video
-> Feed replay phat R2 MP4
`

## Trang thai chinh

live_sessions.status:

- created
- waiting_for_obs
- live
- ended
- processing
- rchiving
- posted
- ailed

rchive_status:

- pending
- eady
- mp4_pending
- rchiving
- posting
- posted
- stream_delete_pending
- rchived
- ailed

## Bao mat

- Cloudflare API token chi nam trong Edge Functions.
- R2 access key/secret chi nam trong Edge Functions.
- Stream Key OBS duoc encrypt bang AES-GCM trong stream_key_encrypted.
- Stream Key chi owner moi xem/copy/reset duoc.
- Webhook verify HMAC signature bang CLOUDFLARE_WEBHOOK_SECRET hoac fallback CLOUDFLARE_STREAM_WEBHOOK_SECRET.
- Frontend khong goi Cloudflare/R2 truc tiep.

## Env can cau hinh

`ash
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_STREAM_API_TOKEN=
CLOUDFLARE_WEBHOOK_SECRET=
CLOUDFLARE_STREAM_WEBHOOK_SECRET=
CLOUDFLARE_STREAM_CUSTOMER_CODE=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_ENDPOINT=
R2_PUBLIC_DOMAIN=
R2_SIGNED_URL_EXPIRES_SECONDS=
STREAM_KEY_ENCRYPTION_SECRET=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
`

## Test checklist

### Webcam Live

- Start Webcam Live.
- Browser xin camera/mic.
- Host join Agora thanh cong.
- Viewer xem duoc realtime.
- Mute/unmute va camera on/off hoat dong.
- End live.
- Replay upload/Cloudflare Stream processing tao live_replays.stream_uid.
- Webhook video ready trigger archive.
- R2 co MP4.
- Feed replay xuat hien voi badge replay/live metadata.
- Replay source la R2 URL.
- Cloudflare Stream video chi bi xoa sau khi archive thanh cong.

### OBS Live

- Tao OBS session tu /live/rtmp/new.
- Copy RTMPS URL + Stream Key vao OBS Custom.
- Start Streaming trong OBS.
- Cloudflare webhook connected -> live_sessions.status = live.
- Dong tab browser, OBS van live.
- Viewer xem HLS live.
- Stop OBS.
- Webhook disconnected -> ended/processing.
- Video READY -> archive MP4 sang R2.
- Replay post xuat hien.
- Creator library co video.
- Stream video bi xoa sau khi R2 + DB + post thanh cong.

### Delete

- Xoa replay post.
- Post soft delete.
- R2 object bi xoa.
- Neu con Cloudflare Stream UID thi xoa Stream.
- creator_library, live_replays, live_sessions mark deleted/cleanup.
- Neu fail thi delete_pending va retry duoc.

### Webhook

- Cau hinh Cloudflare Stream webhook tro toi Supabase function stream-webhook.
- Set secret vao CLOUDFLARE_WEBHOOK_SECRET.
- Test connected/disconnected/video ready payload.
- Payload khong hop le signature phai tra 401.

## Rollback / retry khi loi

- Neu R2 upload fail: giu Cloudflare Stream video, set rchive_status = failed, luu rchive_error, retry etry-archive-replays.
- Neu create/update post fail sau R2 upload: khong delete Stream, retry lai de tao post/library.
- Neu delete Stream fail sau khi R2 da co: set stream_delete_pending/failed, stream_deleted_at van null, retry se verify R2 roi delete Stream tiep.
- Migration moi khong xoa du lieu cu, chi add column/noi constraint/backfill mode nen rollback bang cach revert code hoac deploy migration sua constraint neu can.

## Source code patch day du

Day la patch day du cua tinh nang Fun Profile Live Studio tren repo hien tai.
Ap dung patch nay len codebase tuong ung se co cac thay doi can thiet.

`diff

`

## Ghi chu cho Lovable

Can giu nguyen Agora webcam flow hien co. OBS/RTMP la mode bo sung, khong thay the Agora.
Cloudflare Stream chi la lop ingest/record/transcode tam thoi. Replay/feed cuoi cung phai phat tu Cloudflare R2.
Khong duoc delete Cloudflare Stream video truoc khi R2 upload + verify + DB update + replay post + creator library thanh cong.
