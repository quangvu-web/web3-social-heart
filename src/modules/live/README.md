# Live Streaming (RLS-Only, No Service Role)

This module uses Agora live mode and Supabase RLS with user session JWT.

## Routes

- `/live/new`: create live session and redirect host
- `/live/:liveSessionId/host`: host screen
- `/live/:liveSessionId`: audience screen
- Legacy aliases still supported:
- `/live/stream` -> `/live/new`
- `/live/studio/:liveSessionId` -> `/live/:liveSessionId/host`

## Frontend Deliverables

- `src/modules/live/pages/HostLive.tsx`
- `src/modules/live/pages/AudienceLive.tsx`
- `src/modules/live/api/agora.ts`

API wrappers:

- `getRtcToken({ sessionId?, channelName?, uid?, role, expireSeconds? })`
- `startRecording({ sessionId, channelName, recorderUid, mode })`
- `stopRecording({ sessionId, channelName, recorderUid, resourceId, sid })`

## Supabase Migration

Run SQL migration in Supabase SQL Editor or via CLI:

```sh
supabase db push
```

Required additive migration:

- `supabase/migrations/20260217153000_live_sessions_rls_additive.sql`

It ensures:

- `live_sessions.recording_resource_id`
- `live_sessions.recording_sid`
- `live_sessions.recording_files`
- RLS insert/update with `auth.uid() = host_user_id OR owner_id`
- Public select for `status in ('live', 'ended')`

## Edge Functions

Deploy:

```sh
supabase functions deploy live-token
supabase functions deploy live-recording-start
supabase functions deploy live-recording-stop
```

Edge function env vars:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `LIVE_AGORA_WORKER_URL`
- `LIVE_AGORA_WORKER_API_KEY`
- optional fallback names: `VITE_AGORA_WORKER_URL`, `VITE_AGORA_WORKER_API_KEY`

Recording worker envs (required/preferred):

- `REC_STORAGE_BUCKET`
- `REC_STORAGE_ACCESS_KEY`
- `REC_STORAGE_SECRET_KEY`
- `REC_STORAGE_REGION`
- `REC_R2_ENDPOINT` (S3 endpoint: `https://<account>.r2.cloudflarestorage.com`)
- `PUBLIC_MEDIA_BASE_URL` (public read URL, e.g. `https://pub-xxxx.r2.dev/funprofile/live` or custom domain)
- optional: `REC_ENABLE_HEAD_FALLBACK=true` (only used when Agora query lacks upload status)

Backward-compatible fallback env names still supported:

- `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_REGION`, `R2_ENDPOINT`
- `RECORDING_PLAYBACK_BASE_URL`

## Worker API

Worker keeps old routes and adds `/api/*` aliases:

- `POST /api/agora/rtc-token`
- `POST /api/agora/recording/start`
- `POST /api/agora/recording/stop`
- `GET /api/agora/recording/query`
- `POST /api/recording/start` (internally acquire -> start)
- `POST /api/recording/stop`
- `GET /api/recording/query`

Legacy routes kept:

- `POST /token/rtc`
- `POST /recording/acquire`
- `POST /recording/start`
- `POST /recording/stop`
- `GET /recording/query`

## Cloud Recording Status Semantics

- `uploadingStatus = backuped` means upload is still pending (not playable yet).
- Worker returns `mediaUrl` only when `status = ready` and upload is fully `uploaded`.
- Worker now returns `mediaKey` and `mediaUrl`; `mediaUrl` is always `null` while `status = pending`.
- Frontend must poll query endpoint every 10s (up to 8 minutes) while `status = pending`.

## R2 StorageConfig (Self-Built S3 Compatible)

Agora Cloud Recording is configured with:

- `storageConfig.vendor = 11`
- `storageConfig.extensionParams.endpoint = https://<account>.r2.cloudflarestorage.com`
- plus `bucket`, `accessKey`, `secretKey`, `region`, `fileNamePrefix`

Example Wrangler commands:

```sh
wrangler secret put AGORA_APP_ID
wrangler secret put AGORA_APP_CERTIFICATE
wrangler secret put AGORA_CUSTOMER_ID
wrangler secret put AGORA_CUSTOMER_SECRET
wrangler secret put API_KEY
wrangler secret put REC_STORAGE_BUCKET
wrangler secret put REC_STORAGE_ACCESS_KEY
wrangler secret put REC_STORAGE_SECRET_KEY
wrangler secret put REC_STORAGE_REGION
wrangler secret put REC_R2_ENDPOINT
wrangler secret put PUBLIC_MEDIA_BASE_URL
```

## Security

Never expose in client bundle:

- Agora App Certificate
- Agora customer secret
- R2/S3 credentials
- Supabase service role key

Client only uses:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- user session JWT (from Supabase Auth)

## Verification Checklist

1. Host starts live and audience receives stream in <= 5s.
2. Audience subscribes on `user-published` and stream stops on `user-unpublished`/host leave.
3. Host ends live and `live_sessions.status` becomes `ended`.
4. `recording_files` saved on host-owned row via RLS.
5. No secrets present in frontend source/bundle.
