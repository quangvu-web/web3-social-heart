# Roadmap

## Caption page automatic recovery
- [x] Enable caption_sessions publication safely; preserve table structure and server functions.
- [x] Add parallel 4-second polling, immediate visibility/focus/online catch-up, and 2-second Realtime reconnect without UI changes.
- [x] Bun regression tests 3/3 (32 assertions); build OK. Isolated production-data page: 237→238 without reload; blocked Realtime 239→240 at the next 4-second check; one-minute lifecycle/return simulation 240→247. No production data writes or server function changes.
- [ ] Full-route acceptance remains blocked: signed-out /captions/:code redirects to /law-of-light through the existing guard; unmanaged auth cannot be restored. True hidden-tab one-minute acceptance remains unverified (lifecycle simulation continued polling). Guard intentionally unchanged.
- [ ] Publish current changes and report verified deployment revision.

## Caption operators admin UI
- [x] Add management beside DM bot using the oldest settings row for reads and writes; preserve existing admin gate.
- [x] Support DM-user search, numeric-ID entry, owner label, confirmed removal, and last-operator protection; reread after every write.
- [x] Frontend tests: 15/15 passed including admin access/navigation; Playwright isolated component with mocked responses passed manual add, confirmed removal, DM search/add, oldest-row targeting and last-operator block on desktop/mobile. Frontend build log OK.
- [ ] Verify authenticated production persistence and actual Telegram start/revocation: external unmanaged auth prevents authenticated browser verification; needs real accounts and a test meeting. No production test IDs or real meetings created.

## Caption operator authorization
- [x] Add caption_operator_ids and seed 5373909526 in the existing oldest settings row; verified by production read.
- [x] Gate caption starts fail closed; preserve owner stops and add latest-session operator fallback.
- [x] Deno operator tests 7/7 passed with type checking; production-handler mock regression 1/1 passed with --no-check. Deployed only telegram-community-webhook on 22 October 2026; frontend build log OK.
- [ ] Verify real operator and non-operator Telegram commands after deploy (requires real accounts and a test meeting link).

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
