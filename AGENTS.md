# AGENTS.md — Quy trình làm việc cho Codex / AI agent trên repo FUN Profile (project 7493)

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

> File này được Codex CLI và các AI agent khác tự động đọc khi mở repo. Mọi rule dưới đây phải tuân thủ tuyệt đối.
> Đặt ở GỐC repo, tên đúng `AGENTS.md` (chữ hoa). Mỗi lần con chỉ cần giao NHIỆM VỤ cụ thể — Codex tự lo nhánh, build, commit, push và báo cáo theo mẫu ở mục 6.
> File này chỉ áp dụng cho repo này. Không đụng tới bất kỳ dự án hay repo nào khác.

## 0. Danh tính dự án — kiểm chứng trước mọi sửa đổi

- Repo GitHub: `quangvu-web/web3-social-heart`, nhánh mặc định `main`
- Dự án Lovable: `Remix of FUNPROFILE CỦA BÉ VŨ`, ID `7493b9b9-163e-44ad-a619-bffe188dcc45`
- Bản live: `https://web3-social-heart.lovable.app`
- Backend: **Lovable Cloud** (Supabase managed), ref `xoiceivuqbxnmpfdiklg`
- Package manager: `bun` (không dùng npm/yarn để cài deps trong repo này)

Trước khi sửa bất kỳ file nào, chạy và ghi nhận:

```bash
git remote -v
git status --short
git log -1 --oneline
```

Nếu remote không phải `quangvu-web/web3-social-heart`, hoặc HEAD không khớp `main` mới nhất mà con đã xác nhận, thì DỪNG NGAY, hỏi lại, đừng sửa tiếp.

## 1. Nhánh — KHÔNG BAO GIỜ làm trực tiếp trên `main`

- Không commit, không push trực tiếp lên `main`. Không merge nhánh của mình vào `main`.
- Mỗi nhiệm vụ = một nhánh mới, tách từ `main` mới nhất:
  `codex/<nhiệm-vụ-ngắn>-<yyyymmdd>`, ví dụ `codex/doi-endpoint-angel-20261029`
- Nếu lỡ đang ở `main` mà đã có thay đổi chưa commit, thì làm theo thứ tự này, KHÔNG commit lên `main`:
  ```bash
  git stash push -m "wip: <nhiệm vụ>"
  git checkout -b codex/<nhiệm-vụ>-<yyyymmdd>
  git stash pop
  git status --short
  ```
- Không `--force` lên nhánh chung, không rebase `main`, không xóa nhánh của người khác.

## 2. Phạm vi — sửa ít nhất có thể, đúng nhiệm vụ được giao

- Chỉ sửa các file mà nhiệm vụ nêu tên, hoặc file mà lỗi build/log chỉ thẳng vào.
- Không sửa format, không đổi tên, không dọn code không liên quan, không xóa file nếu nhiệm vụ không nói rõ xóa (nếu xóa, phải ghi lý do xóa trong báo cáo).
- Các vùng CẤM đụng tới nếu nhiệm vụ không nêu đích danh, và nêu đích danh thì vẫn cần con xác nhận riêng:
  - `supabase/config.toml` (chỉ 1 file, không tạo file thứ 2)
  - `supabase/migrations/` đã apply (không sửa tay, không chạy lại)
  - `src/integrations/supabase/types.ts` (auto-gen), `pdk/core/`, `pdk/config/`
  - `.env` và mọi giá trị key/secret trong đó
  - Auth / role / RLS / schema / webhook / bot logic / secrets / dữ liệu production — không sửa chỉ để UI "chạy", phải báo bằng chứng và xin chỉ dẫn
- **Trần 100 Edge Functions (gói Free): dự án đã chạm trần ngày 21/10/2026.** Không deploy function mới khi chưa xử lý — nâng gói hay tắt spend cap là quyết định chi phí của con, Codex không tự quyết.
- Không tự ý Publish Lovable, bật/tắt Auth provider, hay tạo tài khoản test trong database.

## 3. Secrets — tuyệt đối không lộ, không commit

- KHÔNG in, KHÔNG dán, KHÔNG commit password, token, API key, private key, anon/publishable key, service key, mã OTP vào chat, code, commit message hay file nào trong repo.
- Chỉ được nhắc TÊN secret khi cần (ví dụ: "cần `ANGEL_AI_API_KEY` hợp lệ của Angelai Supabase"), không nhắc giá trị.
- Nếu nhiệm vụ cần một secret mới, DỪNG ở bước đó và ghi rõ: tên secret, nhập ở đâu (Lovable Dashboard → Settings → Secrets / form bảo mật), ai nhập. Đừng tự tạo secret rồi gửi lại cho con qua chat.

## 4. Build và kiểm chứng — không nhận vơ là pass

- Cài dependency đúng của dự án này:
  ```bash
  bun install --frozen-lockfile
  ```
  Nếu `bun` chưa có hoặc install kẹt, báo nguyên văn lỗi và thời gian đã chờ, đừng chuyển sang `npm install` rồi im lặng, đừng bảo "chắc là pass".
- Chạy build/test mà dự án có: frontend (`bun test` / `bun run build`), Edge Function (`deno test` nếu có). Ghi kết quả NGUYÊN VĂN: pass, fail kèm lỗi, hoặc unverified kèm lý do.
- Sau khi sửa, đọc lại file đã sửa và chạy:
  ```bash
  git diff --stat
  git diff
  ```
  Kiểm tra: không còn chuỗi lỗi cũ trong file đã sửa, không còn key hardcode, không còn import thừa, không còn ref chết (ví dụ: không còn `ssjoetiitctqzapymtzl` nếu nhiệm vụ là đổi endpoint).
- Sau 2 vòng sửa mà cùng một lỗi vẫn fail, DỪNG, báo bằng chứng từ code/log, đừng đoán mò vòng thứ 3 bằng cách sửa lan sang file khác.
- Tách bạch: frontend test khác Edge Function test. Chỉ gọi "pass" khi đã thật sự chạy thành công.

## 5. Commit và push — chỉ đẩy nhánh, để Cha kiểm chứng

- Commit message tiếng Việt, rõ việc, ví dụ:
  `Đổi endpoint Angel AI mặc định sang Angelai Supabase`
- Chỉ push nhánh của mình:
  ```bash
  git push -u origin codex/<nhiệm-vụ>-<yyyymmdd>
  ```
  KHÔNG `git push origin main`, KHÔNG push kèm tag, KHÔNG tạo pull request rồi tự merge.
- Lovable tự sync trong vài giây. Mở preview kiểm tra trước khi merge vào `main`.
- Nếu lỡ sửa nhầm file cấm → `git checkout HEAD -- <file>` ngay.
- Sau khi push, lấy và ghi vào báo cáo: SHA của commit mới, SHA base của `main` lúc tách nhánh, và link compare trên GitHub:
  `https://github.com/quangvu-web/web3-social-heart/compare/main...codex/<nhiệm-vụ>-<yyyymmdd>`

## 6. Báo cáo cuối — bắt buộc, tiếng Việt, theo đúng mẫu này

Codex phải kết thúc mỗi nhiệm vụ bằng một báo cáo theo mẫu sau, không viết chung chung kiểu "đã xong":

```text
NHIỆM VỤ: <tóm tắt 1 dòng>
NHÁNH: codex/<...> (base: <SHA main lúc tách>, mới: <SHA commit>)
LINK COMPARE: https://github.com/quangvu-web/web3-social-heart/compare/main...codex/<...>
FILE ĐỔI: <tên file> (+<số dòng thêm> -<số dòng bớt>) — ghi từng file
BUILD/TEST: pass / fail / unverified — kèm lỗi nguyên văn nếu fail/unverified
ĐÃ KIỂM CHỨNG: <đã đọc lại file nào, đã chạy lệnh nào, kết quả gì>
CHƯA KIỂM CHỨNG: <cái gì chưa làm được và vì sao>
KHÔNG LÀM: <các việc đã cố ý không đụng tới, ví dụ: không sửa migrations, không deploy function, không động secrets>
BƯỚC TIẾP THEO CẦN NGƯỜI: <merge? deploy lại function nào? nạp secret nào vào Lovable? test live ra sao? Ghi rõ từng bước, đúng thứ tự>
RỦI RO / CẦN CHÚ Ý: <nếu có, nếu không thì ghi "Không có">
```

Quy tắc phân biệt trạng thái, không được lẫn:

- Đẩy nhánh lên GitHub ≠ đã merge vào `main`
- Merge vào `main` ≠ Lovable đã sync xong
- Lovable sync xong ≠ Edge Function đã deploy bản mới (dù Lovable Cloud thường deploy kèm, vẫn phải kiểm chứng)
- Chỉ được ghi "đã live" khi đã kiểm chứng trên bản live `https://web3-social-heart.lovable.app` sau khi sync/deploy.

## 7. Cách con giao việc cho Codex từ nay

Con chỉ cần gửi nhiệm vụ ngắn, ví dụ:

> Đổi endpoint Angel AI mặc định sang Angelai Supabase theo prompt ngày 29/10: 3 chỗ trong _shared/angel-core.ts, angel-health-check, angel-api-status. Không push main, không deploy, báo cáo theo mẫu trong AGENTS.md.

Codex tự lo nhánh, build, commit, push và báo cáo. Cha (Muse) sẽ đọc nhánh đó trên GitHub, đối chiếu với `main`, và báo lại cho con trước khi merge hay deploy — con không cần gửi lại ảnh chụp màn hình hay copy log thủ công nếu Codex đã báo đủ theo mẫu trên.

**Khi nghi ngờ → để Angel quyết định trong Lovable chat. KHÔNG đoán.**

---

## 8. Stack & ngôn ngữ

- React 18 + Vite 5 + Tailwind CSS v3 + TypeScript 5.
- Package manager: **bun** (không dùng npm/yarn để cài deps trong repo này).
- Backend: **Lovable Cloud** (Supabase managed). Không tự host backend khác.

## 9. Branding & UI text

- Brand name hiển thị: **"FUN Profile"** — không bao giờ gọi là "Supabase" trong UI. Dùng "Lovable Cloud / backend / database / auth / functions / storage".
- Tone: "Economy of Light" — Pearl White, Gold. Sang trọng, tối giản.
- Mọi UI text mặc định **tiếng Việt**, trừ khi user dùng tiếng Anh.
- Angel xưng "Angel" (ngôi 3), gọi user là "bé". KHÔNG dùng "Mình/Tôi/Cha/Con/Bạn/Em/Anh/Chị".

## 10. Thời gian

- **Luôn** hiển thị / format thời gian theo **Malaysia Time (UTC+8)**.

## 11. Web3 / Blockchain

- Hardcode BSC RPC: `https://bsc-rpc.publicnode.com`. KHÔNG đổi sang public node khác.
- Mạng mặc định: BSC. Ethereum chỉ là fallback.
- Hỗ trợ ví: MetaMask, Bitget, Trust Wallet, FUN Wallet, BTC Testnet (qua Snaps).

## 12. Supabase / Lovable Cloud

- Exception: `src/integrations/supabase/client.ts` may be edited only for client initialization. It must read `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `import.meta.env`; it must never contain a service-role key or any secret. `src/integrations/supabase/types.ts` remains auto-generated and must not be edited.
- Client import: `import { supabase } from "@/integrations/supabase/client"`.
- Không sửa `src/integrations/supabase/types.ts` (auto-gen).
- `.env` được phép chứa duy nhất `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` để Lovable có thể build frontend. Đây là các giá trị public, không được thêm service-role key, private key, access token, refresh token hoặc backend secret. Không ghi giá trị secret khác vào `.env`.
- `.env.local` vẫn dành cho override local và không được commit.
- KHÔNG chain `.update().select()` — tách thành 2 query: update xong rồi select riêng.
- KHÔNG đụng các schema: `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.
- Mọi migration phải kèm `GRANT` cho table mới trong schema `public`. RLS bắt buộc.
- Codex KHÔNG được tự chạy migration. Nếu cần đổi schema → để user nhờ Angel trong Lovable.

## 13. Edge Functions

- Moderation failure notices use a fresh group-scoped policy gate before the durable claim; missing or unreadable settings suppress with audit so warning delivery cannot bypass group configuration.
- Caption terminal webhooks persist status with a counted compare-and-swap before ACK; summaries run through waitUntil/authenticated one-hop fallback, and bounded on-touch reconciliation checks Recall to recover missed terminal events without schema changes.
- Caption command authorization reads the current oldest community settings row on each check, without caching; creator-scoped stops take precedence over operator fallback to avoid stopping unrelated sessions.
- Group reply language comes from that group's own `telegram_community_settings.reply_language` ('auto' | 'en') via `resolveGroupReplyLanguage`; never hardcode chat ids, so new international groups only need a data flag.
- Luôn dùng `npm:` specifier cho Deno imports. KHÔNG dùng `esm.sh`.
- Wallet-related functions: set `verify_jwt = false` trong `supabase/config.toml`.
- Chỉ có 1 `config.toml` — KHÔNG tạo file thứ 2.
- Bot cộng đồng gọi Angel AI qua `_shared/angel-core.ts` (provider `funcore`, header `x-api-key`); endpoint mặc định trỏ Angelai Supabase, override được bằng env `ANGEL_AI_CHAT_URL` / `ANGEL_AI_ROUTER_URL` / `ANGEL_AI_BASE_URL`. Không hardcode ref Supabase đã chết.

## 14. Mobile layout

- Bất kỳ page nào có `MobileBottomNav` PHẢI có `pb-20` (80px) để input không bị che.

## 15. Chat / Scroll

- Angel FAB guest chat is caption-only with client-only history; use isolated text-only gateway calls without user memory, private RAG or image routing, and fail-closed atomic application quotas on guest ID and hashed IP to protect public access. Keep signed-in getUser validation unchanged.
- FAB coordinates are viewport-clamped and persisted independently of chat identity; use pointer capture with tap/drag separation so dragging never opens the fixed panel.
- Caption pages keep Realtime plus independent incremental polling and return-to-tab catch-up; reconnect failed channels and clean up subscriptions/timers on unmount so captions cannot freeze after a socket drop.
- Dùng `div` native với `overflow-y: auto` cho chat scroll. KHÔNG dùng Radix `ScrollArea`.

## 16. Auth & bảo mật

- User roles lưu ở bảng `user_roles` riêng — KHÔNG bao giờ lưu role trên `profiles`.
- Check admin: dùng function `has_role()` security definer. KHÔNG check ở client storage.
- Base username phải truncate xuống 24 chars + random suffix khi tạo profile.
- OTP rate limit: tối đa 3 request / giờ / user.
- Không để lộ secret, token, JWT (kể cả URL git remote) trong log, ảnh chụp, báo cáo.

## 17. Reward system

- Daily reward max: **500,000 CAMLY** / user.
- Tier: Signup 50k, Post 10k, v.v. (xem `mem://features/rewards` nếu cần chi tiết).
- Anti-Sybil: trust score, 48h delay, 1000 CAMLY requirement.

## 18. Cấm tuyệt đối

- The generated-client restriction above does not apply to the client initialization exception in section 12; all other files under `src/integrations/supabase/` remain protected.
- ❌ Sửa file trong `src/integrations/supabase/types.ts`, `pdk/core/`, `pdk/config/`.
- ❌ Sửa file migration đã apply trong `supabase/migrations/`.
- ❌ Tạo backend Python/Node server trong repo (đây là client-side app).
- ❌ Dùng CSS custom — chỉ Tailwind + design tokens trong `src/index.css`.
- ❌ Hardcode color (`text-white`, `bg-[#xxx]`) — dùng semantic token.
- ❌ Test Google OAuth trong Lovable iframe preview (không chạy được).
- ❌ Thay branding "FUN Profile" / nói "Supabase" trong UI.

## 19. Admin = Telegram Operations (bối cảnh bắt buộc)

- FUN Profile vẫn là sản phẩm chính; Telegram Operations chỉ là khu vận hành bot trong `/admin`, không thay thế/xóa FUN Profile.
- `/admin` (`src/pages/Admin.tsx` + `src/components/admin/telegramOperationsConfig.ts`) là shell Telegram Operations: sidebar nhóm menu, tab qua `?tab=`, menu mobile dạng Sheet. KHÔNG khôi phục "Ultimate Admin Dashboard"/thanh tab ngang cũ nếu không được yêu cầu rõ. Giữ đủ mọi tab và phân quyền khi sửa shell.
- Phân quyền: `has_role` trả `false` = không có quyền admin; RPC lỗi = chưa xác minh được quyền. Hai trường hợp phải báo khác nhau; không nới lỏng/bỏ guard để ép mở trang.
- Không sửa auth/role/RLS, schema, migration, webhook, bot logic, secrets hay dữ liệu production chỉ để UI "chạy" — báo bằng chứng và xin chỉ dẫn.
- Không biến lỗi tải dữ liệu thành danh sách rỗng/số 0 giả: tách rõ đang tải / rỗng / lỗi.
- Trước mọi thay đổi: kiểm tra `git status`, bảo toàn thay đổi sẵn có, chỉ sửa trong phạm vi yêu cầu.
- Caption operator management lives beside DM bot under the existing admin gate; read and update only the oldest community settings row, with fresh reads and compare-and-swap writes to avoid stale concurrent edits.
