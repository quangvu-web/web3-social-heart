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
- Client import: `import { supabase } from "@/integrations/supabase/client"`.
- KHÔNG sửa `src/integrations/supabase/client.ts` và `types.ts` (auto-gen).
- KHÔNG sửa `.env` (VITE_SUPABASE_*) — auto-gen.
- KHÔNG chain `.update().select()` — tách thành 2 query: update xong rồi select riêng.
- KHÔNG đụng các schema: `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.
- Mọi migration phải kèm `GRANT` cho table mới trong schema `public`. RLS bắt buộc.
- Codex KHÔNG được tự chạy migration. Nếu cần đổi schema → để user nhờ Angel trong Lovable.

## 6. Edge Functions
- Luôn dùng `npm:` specifier cho Deno imports. KHÔNG dùng `esm.sh`.
- Wallet-related functions: set `verify_jwt = false` trong `supabase/config.toml`.
- Chỉ có 1 `config.toml` — KHÔNG tạo file thứ 2.

## 7. Mobile layout
- Bất kỳ page nào có `MobileBottomNav` PHẢI có `pb-20` (80px) để input không bị che.

## 8. Chat / Scroll
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
- ❌ Sửa file trong `src/integrations/supabase/`, `pdk/core/`, `pdk/config/`.
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
