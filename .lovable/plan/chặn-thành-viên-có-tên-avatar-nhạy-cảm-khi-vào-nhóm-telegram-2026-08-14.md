# Chặn thành viên có tên / avatar nhạy cảm khi vào nhóm Telegram

## Mục tiêu
Khi một user vừa join nhóm, bot kiểm tra ngay:
1. **Tên hiển thị + username + bio-name** có từ ngữ nhạy cảm (khiêu dâm, mời gọi, quảng cáo bán tài khoản, cờ bạc, CJK bait…) → xoá khỏi nhóm ngay.
2. **Ảnh đại diện** có nội dung nhạy cảm (khoả thân, gợi dục, quảng cáo web18+) → xoá khỏi nhóm ngay.

Kết quả: user bị ban (không cho join lại bằng link cũ), tin nhắn "đã tham gia nhóm" bị xoá, ghi log vào Moderation Logs, có thể bật/tắt và chỉnh ngưỡng trong Admin UI.

## Luồng xử lý (join gate)
Chèn một bước "Join Gate" vào ngay đầu `handleChatMemberUpdate` (và nhánh `new_chat_members`) trong `telegram-community-webhook`, chạy **trước** welcome/verification:

```text
User join
  ├─ 1. Quét TÊN (nhanh, miễn phí)  → nếu bẩn → ban + xoá + log → dừng
  ├─ 2. Quét AVATAR (vision model)  → nếu bẩn → ban + xoá + log → dừng
  └─ 3. Sạch → tiếp tục welcome / verification như hiện tại
```

### 1. Quét tên
- Ghép `first_name + last_name + username` → chuẩn hoá (bỏ dấu, bỏ ký tự lạ/zero-width, leet `s3x`→`sex`).
- Đối chiếu 3 nguồn:
  - Danh sách từ khoá mặc định trong code (18+, escort, bán account, casino, romance-bait CJK) — tái dùng logic đã có cho tin nhắn.
  - Bảng `telegram_community_blocked_keywords` sẵn có (chỉ những từ severity `high`).
  - Danh sách riêng do admin nhập cho tên (lưu trong `telegram_community_settings`).
- Có allowlist để tránh oan (ví dụ tên thật chứa chuỗi trùng).

### 2. Quét avatar
- Lấy ảnh qua `getUserProfilePhotos` (đã có hàm `getCommunityUserAvatarUrl`).
- Không có avatar → bỏ qua (không phạt).
- Gửi ảnh cho vision model `gemini-3.1-flash-lite` (model rẻ nhất, đã dùng cho ảnh trong nhóm) với prompt phân loại trả về JSON: `{ verdict: safe|suspicious|explicit, score, reason }`.
- Kết quả cache theo `file_unique_id` 7 ngày để không tốn credit lặp lại khi user join nhiều nhóm.
- Ngưỡng xử lý cấu hình được: mặc định `explicit` → ban; `suspicious` → chỉ cảnh báo cho admin (không ban).

### 3. Hành động
- `banChatMember` (đã có sẵn) + xoá tin "X đã tham gia nhóm".
- Ghi `telegram_community_moderation_logs` với action `join_blocked_name` / `join_blocked_avatar`, kèm lý do và điểm số.
- Nếu nhóm đã bật cảnh báo admin, gửi thông báo vào chat alert: tên, ID, lý do, ảnh (nếu avatar) — kèm nút không bắt buộc.

## Kiểm soát chi phí
- Quét tên: 0 credit.
- Quét avatar: chỉ chạy khi cờ bật, chỉ 1 lần/ảnh (cache), model rẻ nhất. Thêm cờ `cost.join_avatar_scan_enabled` vào nhóm cờ chi phí đã có, mặc định **bật**, tắt được ngay trong Admin UI.

## Admin UI
Thêm khối "Chặn khi vào nhóm" trong tab moderation của group:
- Bật/tắt quét tên; ô nhập từ khoá riêng + allowlist.
- Bật/tắt quét avatar; chọn ngưỡng (chỉ explicit / explicit + suspicious).
- Chọn hành động: Ban vĩnh viễn (mặc định) hoặc Kick (cho phép join lại).
- Xem log các ca bị chặn ngay trong tab Moderation Logs hiện có.

## Thay đổi kỹ thuật
- Mới: `supabase/functions/_shared/telegram-join-guard.ts` — chuẩn hoá tên, khớp từ khoá, gọi vision, trả verdict + test đi kèm.
- Sửa: `supabase/functions/telegram-community-webhook/index.ts` — gắn join gate vào `handleChatMemberUpdate` và nhánh `new_chat_members`.
- Sửa: `supabase/functions/telegram-community-admin/index.ts` — cho phép đọc/ghi các trường cấu hình mới.
- Migration: thêm cột cấu hình vào `telegram_community_settings` + bảng cache kết quả quét avatar.
- Admin UI: cập nhật tab moderation Telegram.

## Rủi ro & giảm thiểu
- **Chặn oan**: chỉ ban khi từ khoá severity cao hoặc avatar `explicit`; mọi ca đều có log để admin mở khoá bằng ô "Mở khoá quyền nhắn tin"/unban đã có.
- **Telegram ẩn avatar do quyền riêng tư**: coi như sạch, không phạt.
- **Bot thiếu quyền ban**: log rõ lỗi và cảnh báo admin thay vì im lặng.
