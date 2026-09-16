# Chặn quảng cáo bán tài khoản Telegram ("BUBU Store")

## Phân tích: có phải scam không?

Có. Đây là quảng cáo **bán tài khoản Telegram hàng loạt** (bulk TG accounts) — dịch vụ vi phạm ToS của Telegram và là nguồn cung cho spam, lừa đảo, giả mạo danh tính.

Dấu hiệu nhận diện trong tin nhắn:
- "TG Accounts", "Millions of accounts available" — bán tài khoản số lượng lớn.
- "24/7 automated restock", "Guaranteed lowest prices" — mô hình shop tự động.
- "Find us at @LBot" — chốt kèo bằng bot bán hàng bên ngoài.
- Tiếng Anh marketing thuần, không liên quan chủ đề nhóm tiếng Việt.

## Vì sao bot hiện tại không chặn

Các detector hiện có đều trượt:
- `looksLikeCjkPromo` / `looksLikeOffLanguageCjkChatter` — chỉ bắt chữ Hán.
- `looksLikeVietnameseAbuse` — chỉ bắt chửi tục tiếng Việt.
- `looksLikeMentionBait` — cần ≥2 mention bot; tin này chỉ có 1 (`@LBot`).
- `containsBlacklist` — không có từ khoá thương mại loại này.

## Kế hoạch xử lý

### 1. Detector mới: `looksLikeAccountShopPromo(text)`
Chấm điểm theo cụm từ (không phụ thuộc ngôn ngữ), bắt khi đạt ngưỡng:

- **Nhóm hàng hoá** (bắt buộc ≥1): `tg accounts`, `telegram accounts`, `tdata`, `virtual number`, `sms/otp service`, `verified accounts`, `aged accounts`, `session file`, `gmail/whatsapp/instagram accounts`, `bán acc`, `sim ảo`, `code otp`.
- **Nhóm chào hàng** (≥1): `restock`, `lowest price`, `cheapest`, `bulk`, `wholesale`, `in stock`, `auto delivery`, `24/7`, `#1 choice`, `millions of accounts`, `dm to buy`, `giá rẻ nhất`, `sỉ lẻ`.
- **Nhóm chốt kèo** (tăng điểm): có `@handle`, link `t.me/`, hoặc "find us at".

Quy tắc: (hàng hoá + chào hàng) → spam. Chỉ 1 nhóm + có chốt kèo và tin ngắn quảng cáo → spam.
Chuẩn hoá text trước khi khớp: bỏ dấu, bỏ emoji, gộp khoảng trắng, xử lý né tránh kiểu `a c c o u n t s`, `t.g`, `acc0unt`.

### 2. Detector phụ: "storefront blast"
Tin nhắn có cấu trúc quảng cáo shop: nhiều dòng ngắn, có emoji đầu dòng, chứa khẩu hiệu (`Simple, Fast, & Secure`, `Guaranteed`, `Your #1 Choice`) + 1 handle liên hệ, và **không có nội dung hội thoại thật** → cộng điểm cùng bước 1.

### 3. Hành động
Giống chuỗi xử lý `automated_cjk_scam` hiện tại:
- Match chắc chắn (2 nhóm trở lên) → **xoá tin + ban** người gửi, ghi `telegram_ai_audit` với lý do `account_shop_promo`.
- Match yếu (1 nhóm + chốt kèo) → **xoá tin + cảnh cáo**, cộng strike; đủ ngưỡng thì ban.
- Miễn trừ admin và handle trong `trusted_telegram_handles`.

### 4. Cấu hình admin
Thêm cờ trong `telegram_community_settings`:
- `account_shop_guard_enabled` (mặc định BẬT)
- `account_shop_action` (`ban` | `warn`, mặc định `ban`)

Hiển thị trong tab bảo mật Telegram của Admin UI.

### 5. Kiểm thử
Thêm case vào `telegram-community.spam.test.ts`:
- Nguyên văn tin BUBU Store → bị chặn.
- Biến thể né: `T G  A c c o u n t s cheap bulk @shopbot` → bị chặn.
- Lành tính: "Mình quên mật khẩu tài khoản Telegram, ai giúp với" → KHÔNG chặn.
- Lành tính: "Nhóm mình có bao nhiêu tài khoản đang online vậy?" → KHÔNG chặn.

## Chi tiết kỹ thuật
- Sửa `supabase/functions/_shared/telegram-community.ts`: thêm `ACCOUNT_SHOP_PATTERNS` + `looksLikeAccountShopPromo`.
- Sửa `supabase/functions/telegram-community-webhook/index.ts`: cắm detector vào pipeline moderation (trước khi gọi AI), hành động xoá/ban + audit.
- Migration: 2 cột cấu hình mới cho `telegram_community_settings`.
- Admin UI: 2 ô cấu hình trong `TelegramGroupPanel.tsx`.
- Không đụng tới bot Telegram 2FA.
