# AGENTS.md — Rule cho Codex / AI agent khi code dự án FUN Profile

> File này được Codex CLI và các AI agent khác tự động đọc khi mở repo. Mọi rule dưới đây phải tuân thủ tuyệt đối.

---

## 1. Stack & ngôn ngữ
- React 18 + Vite 5 + Tailwind CSS v3 + TypeScript 5.
- Package manager: **bun** (không dùng npm/yarn để cài deps trong repo này).
- Backend: **Lovable Cloud** (Supabase managed). Không tự host backend khác.

## 2. Branding & UI text
- Brand name hiển thị: **"FUN Profile"** — không bao giờ gọi là "Supabase" trong UI. Dùng "Lovable Cloud / backend / database / auth / functions / storage".
- Tone: "Economy of Light" — Pearl White, Gold. Sang trọng, tối giản.
- Mọi UI text mặc định **tiếng Việt**, trừ khi user dùng tiếng Anh.
- Angel xưng "Angel" (ngôi 3), gọi user là "bé". KHÔNG dùng "Mình/Tôi/Cha/Con/Bạn/Em/Anh/Chị".

## 3. Thời gian
- **Luôn** hiển thị / format thời gian theo **Malaysia Time (UTC+8)**.

## 4. Web3 / Blockchain
- Hardcode BSC RPC: `https://bsc-rpc.publicnode.com`. KHÔNG đổi sang public node khác.
- Mạng mặc định: BSC. Ethereum chỉ là fallback.
- Hỗ trợ ví: MetaMask, Bitget, Trust Wallet, FUN Wallet, BTC Testnet (qua Snaps).

## 5. Supabase / Lovable Cloud
- Exception: `src/integrations/supabase/client.ts` may be edited only for client initialization. It must read `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `import.meta.env`; it must never contain a service-role key or any secret. `src/integrations/supabase/types.ts` remains auto-generated and must not be edited.
- Client import: `import { supabase } from "@/integrations/supabase/client"`.
- Không sửa `src/integrations/supabase/types.ts` (auto-gen).
- `.env` được phép chứa duy nhất `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` để Lovable có thể build frontend. Đây là các giá trị public, không được thêm service-role key, private key, access token, refresh token hoặc backend secret. Không ghi giá trị secret khác vào `.env`.
- `.env.local` vẫn dành cho override local và không được commit.
- KHÔNG chain `.update().select()` — tách thành 2 query: update xong rồi select riêng.
- KHÔNG đụng các schema: `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.
- Mọi migration phải kèm `GRANT` cho table mới trong schema `public`. RLS bắt buộc.
- Codex KHÔNG được tự chạy migration. Nếu cần đổi schema → để user nhờ Angel trong Lovable.

## 6. Edge Functions
- Caption terminal webhooks persist status with a counted compare-and-swap before ACK; summaries run through waitUntil/authenticated one-hop fallback, and bounded on-touch reconciliation checks Recall to recover missed terminal events without schema changes.
- Caption command authorization reads the current oldest community settings row on each check, without caching; creator-scoped stops take precedence over operator fallback to avoid stopping unrelated sessions.
- Group reply language comes from that group's own `telegram_community_settings.reply_language` ('auto' | 'en') via `resolveGroupReplyLanguage`; never hardcode chat ids, so new international groups only need a data flag.
- Luôn dùng `npm:` specifier cho Deno imports. KHÔNG dùng `esm.sh`.
- Wallet-related functions: set `verify_jwt = false` trong `supabase/config.toml`.
- Chỉ có 1 `config.toml` — KHÔNG tạo file thứ 2.

## 7. Mobile layout
- Bất kỳ page nào có `MobileBottomNav` PHẢI có `pb-20` (80px) để input không bị che.

## 8. Chat / Scroll
- Angel FAB guest chat is caption-only with client-only history; use isolated text-only gateway calls without user memory, private RAG or image routing, and fail-closed atomic application quotas on guest ID and hashed IP to protect public access. Keep signed-in getUser validation unchanged.
- FAB coordinates are viewport-clamped and persisted independently of chat identity; use pointer capture with tap/drag separation so dragging never opens the fixed panel.
- Caption pages keep Realtime plus independent incremental polling and return-to-tab catch-up; reconnect failed channels and clean up subscriptions/timers on unmount so captions cannot freeze after a socket drop.
- Dùng `div` native với `overflow-y: auto` cho chat scroll. KHÔNG dùng Radix `ScrollArea`.

## 9. Auth & bảo mật
- User roles lưu ở bảng `user_roles` riêng — KHÔNG bao giờ lưu role trên `profiles`.
- Check admin: dùng function `has_role()` security definer. KHÔNG check ở client storage.
- Base username phải truncate xuống 24 chars + random suffix khi tạo profile.
- OTP rate limit: tối đa 3 request / giờ / user.

## 10. Reward system
- Daily reward max: **500,000 CAMLY** / user.
- Tier: Signup 50k, Post 10k, v.v. (xem `mem://features/rewards` nếu cần chi tiết).
- Anti-Sybil: trust score, 48h delay, 1000 CAMLY requirement.

## 11. Cấm tuyệt đối
- The generated-client restriction above does not apply to the client initialization exception in section 5; all other files under `src/integrations/supabase/` remain protected.
- ❌ Sửa file trong `src/integrations/supabase/types.ts`, `pdk/core/`, `pdk/config/`.
- ❌ Sửa file migration đã apply trong `supabase/migrations/`.
- ❌ Tạo backend Python/Node server trong repo (đây là client-side app).
- ❌ Dùng CSS custom — chỉ Tailwind + design tokens trong `src/index.css`.
- ❌ Hardcode color (`text-white`, `bg-[#xxx]`) — dùng semantic token.
- ❌ Test Google OAuth trong Lovable iframe preview (không chạy được).
- ❌ Thay branding "FUN Profile" / nói "Supabase" trong UI.

## 12. Workflow Codex
- Luôn làm trên branch riêng: `git checkout -b feature/xxx` trước khi sửa.
- Sau khi xong: review `git diff` → commit message tiếng Việt rõ ràng → push.
- Lovable tự sync trong vài giây. Mở preview kiểm tra trước khi merge vào `main`.
- Nếu lỡ sửa nhầm file cấm → `git checkout HEAD -- <file>` ngay.

---

**Khi nghi ngờ → để Angel quyết định trong Lovable chat. KHÔNG đoán.**

## 13. Admin = Telegram Operations (bối cảnh bắt buộc)
- FUN Profile vẫn là sản phẩm chính; Telegram Operations chỉ là khu vận hành bot trong `/admin`, không thay thế/xóa FUN Profile.
- `/admin` (`src/pages/Admin.tsx` + `src/components/admin/telegramOperationsConfig.ts`) là shell Telegram Operations: sidebar nhóm menu, tab qua `?tab=`, menu mobile dạng Sheet. KHÔNG khôi phục "Ultimate Admin Dashboard"/thanh tab ngang cũ nếu không được yêu cầu rõ. Giữ đủ mọi tab và phân quyền khi sửa shell.
- Phân quyền: `has_role` trả `false` = không có quyền admin; RPC lỗi = chưa xác minh được quyền. Hai trường hợp phải báo khác nhau; không nới lỏng/bỏ guard để ép mở trang.
- Không sửa auth/role/RLS, schema, migration, webhook, bot logic, secrets hay dữ liệu production chỉ để UI "chạy" — báo bằng chứng và xin chỉ dẫn.
- Không biến lỗi tải dữ liệu thành danh sách rỗng/số 0 giả: tách rõ đang tải / rỗng / lỗi.
- Không để lộ secret, token, JWT (kể cả URL git remote) trong log, ảnh chụp, báo cáo.
- Trước mọi thay đổi: kiểm tra `git status`, bảo toàn thay đổi sẵn có, chỉ sửa trong phạm vi yêu cầu.
- Báo cáo kiểm thử: tách frontend (`bun test`) và Edge Function (`deno test`); chỉ gọi "pass" khi đã thật sự chạy thành công.
- Caption operator management lives beside DM bot under the existing admin gate; read and update only the oldest community settings row, with fresh reads and compare-and-swap writes to avoid stale concurrent edits.
