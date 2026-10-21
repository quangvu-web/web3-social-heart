# Roadmap

## Open tasks
1. Update values of the 69 remixed secrets (AGORA_*, TELEGRAM_*, R2_*, etc.) — paused: user declined the bulk secure forms. Secrets already exist with carried-over values; confirm whether any actually need new values.
2. Missing frontend setting reported (optional): `VITE_WALLETCONNECT_PROJECT_ID` — WalletConnect mobile deep links stay disabled until it is provided.
3. angel-channel-manage: replace direct user_roles query with has_role RPC (+ regression tests). Code only — no deploy/migration until user reviews diff.
4. Google login + Telegram 2FA OTP not shown (routed /auth page lacks 2FA gating) — plan drafted, paused for the admin-check fix.

5. Telegram CAPTCHA + 24 bot tables: service_role grants applied (verified). P1-2 settings-lookup fix deployed. Next: P1-4 ban confirmations, P1-3 bot permission check — awaiting user go-ahead.

## Done
- Verified external Supabase project `funprofile-production` (ref xoiceivuqbxnmpfdiklg) is connected and the frontend `.env` points at it.
- Produced the per-platform secret name inventory (Edge Functions / Cloudflare Worker / frontend VITE).
- Fixed the "Không thể tải FUN Profile" crash: duplicate realtime channel topics shared across simultaneously mounted hooks.

## Angel Caption Bot — Phase 1 (xong 22/10/2026)
- [x] Migration caption_sessions + caption_lines (RLS, Realtime)
- [x] Edge function angel-caption (4 action) — đã deploy; đã gỡ live-start/live-stop/live-recording-proxy theo phương án dự phòng
- [x] Lệnh Telegram /caption + /caption_stop trong telegram-community-webhook
- [x] Trang /captions/:code + Realtime
- [ ] Bé nạp 3 secrets: RECALL_API_KEY, RECALL_VERIFICATION_SECRET, CAPTION_INTERNAL_TOKEN
- [ ] Bé đăng ký webhook URL trong Recall Dashboard
- [ ] Chủ dự án chạy buổi pilot thật (Angel không gọi Recall thật)
- [ ] Phase 2: cron dọn caption_lines sau 30 ngày, xuất .srt/.txt, trang quản trị phiên

## Caption command routing repair
- [x] Recall payload repair: nested bot/metadata/status extraction and pending/joining recovery deployed only angel-caption around 07:35:40 MYT on 22 October 2026. Production session 28w7jae76wpf recovered live at 07:35:44 with 4 lines on first read; no unknown-bot warnings newer than 07:35:38 in subsequent logs. Deno tests 11/11 pass; full check blocked by 4 existing shared-file errors (outside scope). Browser caption page verification timed out on both local and published URLs; UI remains unverified.
- [x] Prioritize caption commands; deployed webhook and admin command definitions on 22 October 2026 (UTC+8).
- [x] Deno runtime regression: 1 passed, 0 failed (network denied, --no-check; SDK timer sanitizers disabled). Full handler typecheck has 8 existing dependency/legacy errors, outside scope; not reported as passing.
- [ ] Register live bot menu: admin endpoint returns 401 without a session; sandbox bot credential fails getMe HTTP 404. Requires authorized admin setup action using production credentials.
- [x] Anonymous caption_sessions read using frontend build public key returns HTTP 200; frontend build log OK.
- [ ] Verify owner DM on production and new caption_command log: waiting for real Telegram message; no matching post-deploy log yet. Pre-deploy source cannot be downloaded without management access token.
