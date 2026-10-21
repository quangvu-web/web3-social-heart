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
- [ ] Prioritize caption commands and run regression tests.
- [ ] Verify deployed webhook, deploy repair and register bot commands.
- [ ] Check frontend publishable access and real owner DM outcome.
