# Danh sách secrets/env vars chính xác theo nền tảng chạy

Nguồn: quét trực tiếp `supabase/functions` (125 functions), `worker/src`, và `src` (frontend). Không đọc, không in giá trị secret. Không sửa code hay settings.

## 1. Supabase Edge Function secrets (funprofile-production)

Cấu hình tại: Supabase Dashboard → Project `funprofile-production` → Edge Functions → Secrets (hoặc `supabase secrets set`). KHÔNG dùng Lovable Cloud Secrets.

### Tự động có sẵn (Supabase tự cung cấp, không cần set)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Agora (livestream + cloud recording)
- `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`
- `AGORA_CUSTOMER_ID`, `AGORA_CUSTOMER_SECRET`
- `AGORA_CLOUD_RECORDING_MAX_ACTIVE`, `AGORA_RECORDING_MAX_IDLE_TIME`
- `AGORA_RECORDING_PLAYBACK_BASE_URL`
- `AGORA_STORAGE_ACCESS_KEY`, `AGORA_STORAGE_SECRET_KEY`, `AGORA_STORAGE_BUCKET`, `AGORA_STORAGE_ENDPOINT`, `AGORA_STORAGE_REGION`
- `AGORA_RTMP_CONVERTER_PATH`, `AGORA_RTMP_EGRESS_API_URL`, `AGORA_RTMP_EGRESS_STOP_API_URL` (optional — có default trong code)

### Cloudflare R2 / Stream
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCESS_KEY_ID`, `CLOUDFLARE_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_PUBLIC_URL`
- `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_CUSTOMER_CODE`
- `CLOUDFLARE_STREAM_WEBHOOK_SECRET`, `CLOUDFLARE_WEBHOOK_SECRET`, `CLOUDFLARE_STREAM_TOKEN`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_ARCHIVE_BUCKET`, `R2_TEMP_BUCKET`
- `R2_PUBLIC_BASE_URL`, `R2_PUBLIC_DOMAIN`

### Recording worker bridge
- `LIVE_AGORA_WORKER_URL`, `LIVE_AGORA_WORKER_API_KEY`
- `BROWSER_RECORDING_MAX_CHUNK_BYTES`
- `VITE_AGORA_WORKER_URL`, `VITE_AGORA_WORKER_API_KEY` (functions cũng đọc 2 tên này)

### Angel AI
- `ANGEL_AI_API_KEY`, `ANGEL_AI_BASE_URL`, `ANGEL_AI_PROVIDER`
- `ANGEL_AI_CHAT_URL`, `ANGEL_AI_CHAT_BEARER`, `ANGEL_AI_ROUTER_URL`, `ANGEL_AI_API_KEY_IMAGE`
- `ANGEL_ROOT_API_KEY`, `ANGEL_ROOT_BASE_URL`, `ANGEL_ROOT_API_KEY_IMAGE`
- `ANGEL_KNOWLEDGE_INGEST_KEY`, `ANGEL_BOT_USER_ID`
- `GEMINI_API_KEY`, `FAL_API_KEY`, `YOUTUBE_COOKIE`
- Optional/tuning (có default): `ANGEL_FAL_ENABLED`, `ANGEL_FAL_DAILY_LIMIT`, `ANGEL_FAL_MODEL_DEFAULT`, `ANGEL_FAL_MODEL_HEAVY`, `ANGEL_FAL_MODEL_LOGO`, `ANGEL_GEMINI_DIRECT_FALLBACK`, `ANGEL_GEMINI_DIRECT_MODEL`, `ANGEL_LOVABLE_FALLBACK_ENABLED`, `ANGEL_LOVABLE_FALLBACK_DAILY_LIMIT`, `ANGEL_MODEL_VISION`, `ANGEL_YT_DISABLED`

### App / site URLs
- `APP_URL`, `SITE_URL`, `FUN_API_URL`, `FUN_PROFILE_APP_KEY`, `FUN_PROFILE_ORIGIN`

### Cron & security (nên generate MỚI cho Remix)
- `CRON_SECRET`, `SCHEDULED_FUNCTION_SECRET`, `MEDITATION_CRON_SECRET`
- `EMAIL_OTP_HASH_SECRET`
- `LOVABLE_CRON_SECRET`, `LOVABLE_CRON_SECRET_PREVIOUS` (chỉ còn vài chỗ dùng; có thể bỏ nếu migrate hết sang `CRON_SECRET`)

### Email
- `RESEND_API_KEY`

### Restream
- `RESTREAM_CLIENT_ID`, `RESTREAM_CLIENT_SECRET`, `RESTREAM_REDIRECT_URI`

### Crypto / ví
- `TREASURY_PRIVATE_KEY`, `TREASURY_WALLET_ADDRESS`
- `WALLET_ENCRYPTION_KEY`, `STREAM_KEY_ENCRYPTION_SECRET`
- `ZEROX_API_KEY`

### Telegram
- Bot: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`
- User bot: `TELEGRAM_USER_API_ID`, `TELEGRAM_USER_API_HASH`, `TELEGRAM_USER_PHONE`, `TELEGRAM_USER_2FA_PASSWORD`, `TELEGRAM_USER_OTP`
- Community Guard: `COMMUNITY_GUARD_BOT_TOKEN`, `COMMUNITY_GUARD_BOT_USERNAME`, `COMMUNITY_GUARD_GROUP_ID`, `COMMUNITY_GUARD_WEBHOOK_SECRET`

### AI Gateway (Lovable)
- `LOVABLE_API_KEY` — cần nếu vẫn muốn dùng Lovable AI Gateway từ external Supabase; nếu không, bỏ qua và Angel sẽ fallback sang `ANGEL_AI_*`/`GEMINI_API_KEY`

## 2. Cloudflare Worker secrets (worker `fun-agora-rtc-token`)

Cấu hình tại: Cloudflare Dashboard → Workers → `fun-agora-rtc-token` → Settings → Variables and Secrets (hoặc `wrangler secret put`).

- `API_KEY` — secret chung giữa Worker và Edge Functions (phải trùng `LIVE_AGORA_WORKER_API_KEY` / `VITE_AGORA_WORKER_API_KEY`)
- `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`
- `AGORA_CUSTOMER_ID`, `AGORA_CUSTOMER_SECRET` (recording control)
- `TOKEN_TTL_SECONDS` (optional, có default)
- `ALLOWED_ORIGINS` (optional, CORS)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — trỏ về `funprofile-production`
- Bindings (không phải secret string): `RECORDINGS_BUCKET` là R2 bucket binding; `RECORDING_PLAYBACK_BASE_URL` là biến thường

## 3. Frontend public env vars (Vite build-time, KHÔNG phải secret)

Đặt trong `.env` của frontend (publishable, an toàn khi lộ):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROJECT_ID` — của project `funprofile-production`
- `VITE_AGORA_WORKER_URL`
- `VITE_WALLETCONNECT_PROJECT_ID`
- `VITE_ZEROX_API_KEY`, `VITE_ZEROX_API_BASE_URL`
- `VITE_MOONPAY_API_KEY`, `VITE_MOONPAY_BASE_URL`
- `VITE_BSC_RPC_URL` (default: `https://bsc-rpc.publicnode.com`)
- `VITE_BITCOIN_SNAP_ID`
- `VITE_CLOUDFLARE_R2_PUBLIC_URL`
- `VITE_FUN_CLIENT_ID`
- `VITE_ENABLE_WALLET_AUTH_DEBUG` (optional, dev only)

## Ghi chú quan trọng
- Secrets từ Lovable Cloud cũ KHÔNG tự chuyển sang external Supabase — phải set lại toàn bộ nhóm 1 bằng `supabase secrets set` hoặc Dashboard.
- Giá trị cũ có thể tái sử dụng an toàn: Agora, Cloudflare/R2, Restream, Telegram bot tokens, RESEND, FAL, GEMINI, wallet keys.
- Nên generate MỚI: `CRON_SECRET`, `SCHEDULED_FUNCTION_SECRET`, `EMAIL_OTP_HASH_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, `COMMUNITY_GUARD_WEBHOOK_SECRET`, `CLOUDFLARE_STREAM_WEBHOOK_SECRET`, `API_KEY` (Worker bridge).
- Phải cập nhật theo địa chỉ mới: `APP_URL`, `SITE_URL`, `FUN_PROFILE_ORIGIN`, `RESTREAM_REDIRECT_URI`, `AGORA_RECORDING_PLAYBACK_BASE_URL`, `LIVE_AGORA_WORKER_URL`.
