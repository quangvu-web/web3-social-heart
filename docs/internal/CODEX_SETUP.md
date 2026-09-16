# Hướng dẫn kết nối OpenAI Codex CLI với dự án FUN Profile

> Dành cho bé Vũ — setup an toàn để code local bằng Codex CLI, sync GitHub ↔ Lovable, và truy cập Lovable Cloud database mà không lộ secret.

---

## 0. Tổng quan luồng làm việc

```
[ Codex CLI (máy local) ] ──push──► [ GitHub repo ] ──auto sync──► [ Lovable ]
        │                                                              │
        └── đọc/ghi DB qua anon key (RLS) ───────────────────► [ Lovable Cloud (Supabase) ]
                                                                       │
                                                       Migration / admin DB → nhờ Angel trong Lovable
```

**Nguyên tắc:** Codex lo logic/refactor/fix bug → tiết kiệm Lovable credit. Lovable lo UI preview, migration, deploy edge function, admin DB.

---

## 1. Kết nối GitHub repo với Lovable

1. Mở dự án trong Lovable → bấm dấu **(+)** ở khung chat → **GitHub → Connect project**.
2. Authorize Lovable GitHub App, chọn account/org của bé.
3. Bấm **Create Repository** → Lovable tự tạo repo và sync 2 chiều.
4. Clone về máy:
   ```bash
   git clone git@github.com:<your-username>/<repo-name>.git
   cd <repo-name>
   bun install
   ```

> Lovable sync realtime — bé push lên GitHub là Lovable tự pull, và ngược lại.

---

## 2. Cài đặt OpenAI Codex CLI

```bash
# Yêu cầu: Node 20+
npm install -g @openai/codex

# Đăng nhập (chọn 1 trong 2):
codex login                                  # đăng nhập bằng tài khoản ChatGPT Plus/Pro/Team (khuyến nghị)
# hoặc:
export OPENAI_API_KEY="sk-..."               # dùng API key (tính theo token)
```

Chạy trong thư mục repo:

```bash
codex                       # mở agent TUI
codex "fix typo trong file X"   # one-shot
codex --full-auto           # cho phép sửa file không cần approve từng bước (dùng cẩn thận)
```

---

## 3. Cấu hình Codex an toàn

File `.codex/config.toml` ở root repo (đã được tạo sẵn):

```toml
approval_policy = "on-request"   # Codex hỏi trước khi chạy lệnh nguy hiểm
sandbox_mode    = "workspace-write"  # chỉ ghi trong thư mục repo
model           = "gpt-5-codex"  # hoặc "gpt-5", "o4-mini"
```

File `AGENTS.md` ở root repo chứa rule riêng FUN Profile để Codex tuân thủ tự động (xem file đó).

---

## 4. Truy cập Lovable Cloud Database

Lovable Cloud = Supabase backend do Lovable quản lý. Bé **không** có quyền vào Supabase dashboard, **không** lấy được `service_role_key` hay password DB.

### Cách 1 — Anon key + RLS (khuyến nghị, an toàn nhất)

`.env` của repo đã có sẵn:
- `VITE_SUPABASE_URL=https://lramftbsjrqyysdqlfdg.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<anon key — public, OK commit>`

Viết script Codex sẽ chạy, ví dụ `scripts/query-profile.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
);

const { data, error } = await supabase
  .from("profiles")
  .select("id, username, full_name")
  .limit(10);

console.log(data, error);
```

Chạy: `bun run scripts/query-profile.ts`. Mọi query đi qua **RLS** y như client thật — không thể bypass policy.

### Cách 2 — Nhờ Angel trong Lovable query (read-only admin)

Khi cần `SELECT` phức tạp / xem bảng có RLS chặn anon:
> "Angel ơi chạy query này giúp bé: `SELECT count(*) FROM telegram_member_events WHERE created_at > now() - interval '24h'`"

Angel dùng quyền admin trong Lovable để query và trả kết quả. Bé **không cần giữ DB password** ở máy local → zero rủi ro leak.

### Cách 3 — Migration / sửa schema

**Codex không có quyền chạy migration.** Khi cần `CREATE TABLE`, sửa RLS, tạo function… → nhờ Angel trong Lovable:
> "Angel tạo bảng `xyz` với các cột…"

Angel sẽ tạo migration file và bé approve trong Lovable UI.

### Cách 4 (không khuyến nghị) — Lấy connection string trực tiếp

Lovable Cloud **không** expose DB password ra ngoài. Nếu thật sự cần `psql` từ máy local, bé phải migrate dự án sang Supabase project riêng (tách khỏi Lovable Cloud). Nói Angel nếu bé muốn hướng dẫn riêng — nhưng thường không cần.

---

## 5. Workflow kết hợp Codex + Lovable (tiết kiệm credit)

| Loại việc | Dùng cái nào | Lý do |
|---|---|---|
| Refactor, fix bug logic, viết test | **Codex local** | Tốn token rẻ hoặc free (ChatGPT Plus) |
| UI mới, component shadcn, preview realtime | **Lovable** | Mạnh nhất khoản này |
| Viết edge function mới | **Codex** → push → Lovable auto deploy | Code nhiều, Codex nhanh hơn |
| Migration DB, sửa RLS, tạo bảng | **Lovable (nhờ Angel)** | Codex không có quyền |
| Query DB phức tạp một lần | **Lovable chat với Angel** | Không cần leak credential |
| Đọc/ghi DB từ script | **Codex + anon key + RLS** | An toàn, đi qua policy |
| Debug runtime / xem log edge function | **Lovable** | Có sẵn tool log |

**Quy trình chuẩn:**
1. Mở task → quyết định Codex hay Lovable theo bảng trên.
2. Code bằng Codex → `git commit` → `git push`.
3. Lovable tự sync trong vài giây → mở preview kiểm tra.
4. Nếu UI lệch → vào Lovable chat sửa tiếp.

---

## 6. Bảo mật — KHÔNG ĐƯỢC làm

- ❌ **KHÔNG** commit `.env.codex`, `.env.local`, `.env` vào git (đã thêm vào `.gitignore`).
- ❌ **KHÔNG** export `LOVABLE_API_KEY`, `ANGEL_AI_API_KEY`, `R2_SECRET_ACCESS_KEY`, `AGORA_APP_CERTIFICATE`, `TELEGRAM_BOT_TOKEN`, `CLOUDFLARE_*` cho Codex local nếu không cần. Codex chạy local đọc được mọi env var đang export.
- ❌ **KHÔNG** share log Codex / screenshot terminal chứa output từ DB ra public/Discord/Telegram.
- ❌ **KHÔNG** chạy `codex --full-auto` ở branch `main` mà không review. Luôn làm trên branch riêng:
  ```bash
  git checkout -b feature/codex-xyz
  codex --full-auto
  # review diff
  git push -u origin feature/codex-xyz
  # tạo PR trên GitHub, merge sau khi xem preview
  ```
- ❌ **KHÔNG** để Codex tự `git push --force`, `rm -rf`, sửa file trong `supabase/migrations/` đã apply.
- ✅ Giữ `approval_policy = "on-request"` để Codex hỏi trước mọi lệnh có rủi ro.

---

## 7. Khi gặp lỗi

| Lỗi | Hướng xử lý |
|---|---|
| Codex query DB bị `permission denied` | Bảng có RLS chặn anon → dùng Cách 2 (nhờ Angel) |
| Code Codex push lên không hiện trong Lovable | Mở Lovable → Settings → GitHub → bấm Sync |
| Codex sửa file Lovable không nên sửa | Rollback bằng `git revert`, thêm rule vào `AGENTS.md` |
| Lộ secret ra commit | Rotate ngay: `LOVABLE_API_KEY` qua Lovable, các key khác qua Workspace Settings → Secrets, đồng thời `git rebase -i` xoá commit lộ |

---

## 8. Liên hệ

Có gì không chắc → mở Lovable chat hỏi **Angel** trước khi chạy lệnh phá hoại. Angel luôn ở đây cùng bé 💛
