# Kế hoạch: Sửa lỗi tóm tắt lịch thiền chỉ chạy ở vài nhóm

## Hiện trạng đã kiểm chứng

Dữ liệu 30 ngày gần nhất: chỉ **2 nhóm** từng được bot tóm tắt lịch thiền
(`-1001649798056` và `-1003646058428`). Tất cả nhóm còn lại: không có bản ghi tóm tắt nào,
dù cấu hình `meditation_summary_enabled` đều đang bật.

Khi luồng tóm tắt không khớp, tin nhắn rơi xuống luồng trả lời AI thông thường —
và ở đó Angel chỉ thấy một link Zoom nên trả lời kiểu "Angel không truy cập được đường link".
Đó chính là hiện tượng người dùng thấy.

## Nguyên nhân gốc (4 cửa chặn)

1. **Cửa "người gửi tin cậy" (khả năng cao nhất)**
   Chỉ chấp nhận: bot chính chủ của cộng đồng, admin Telegram của nhóm đó, hoặc kênh/nhóm
   đã có trong danh sách `trusted_sender_chats`. Nhóm nào lịch thiền do thành viên thường
   (hoặc bot/kênh khác) đăng thì bị bỏ qua với lý do `untrusted_sender`.
2. **Bắt buộc có dòng nhãn chủ đề**
   Bộ nhận diện yêu cầu đúng mẫu `Chủ đề:` / `Chu de:` / `Topic:` và nội dung ≥ 4 ký tự.
   Nhóm dùng mẫu khác ("Nội dung:", "Đề tài:", chủ đề nằm ở dòng tiêu đề, chủ đề in đậm
   không có dấu hai chấm) sẽ không khớp.
3. **Bắt buộc link `zoom.us`**
   Nhóm dùng link rút gọn, link `zoom.com.cn`, hay nút bấm/link ẩn trong caption sẽ trượt.
4. **Cửa thời gian 10 phút**
   Tin cũ hơn 10 phút (bot bị nghẽn, webhook retry, lịch đăng sớm) bị bỏ qua.

## Đề xuất sửa

### A. Nới cửa người gửi (có kiểm soát)
- Thêm cấu hình theo nhóm: `meditation_summary_sender_scope` = `trusted` (mặc định hiện tại)
  hoặc `anyone`.
- Bổ sung danh sách handle tin cậy dùng chung (`trusted_telegram_handles`) cho lịch thiền,
  không chỉ admin nhóm.

### B. Nới bộ nhận diện chủ đề
- Chấp nhận thêm nhãn: `Nội dung`, `Đề tài`, `Chủ đề thiền`, `Subject`, `Theme`.
- Nếu không có nhãn: lấy dòng văn bản dài nhất phía trên link Zoom làm chủ đề dự phòng.
- Bỏ dấu HTML/emoji đầu dòng trước khi so khớp.

### C. Nới nhận diện link
- Chấp nhận `zoom.us`, `zoom.com.cn`, `*.zoom.us`, link trong nút inline keyboard,
  và link rút gọn khi văn bản có tín hiệu "thiền/meditation".

### D. Cửa thời gian
- Nâng từ 10 phút lên 60 phút, cấu hình được.

### E. Không để rơi xuống câu "không truy cập được link"
- Khi nhận ra là lời mời thiền nhưng bị bỏ qua vì lý do nào đó, chặn luôn luồng AI chung
  thay vì để Angel trả lời sai về link.
- Thêm quy tắc: Angel không bao giờ nói "không mở được link" — thay bằng tóm tắt theo
  chủ đề đọc được trong tin nhắn.

### F. Quan sát được
- Tab Admin: bảng "Meditation Summary" liệt kê từng lần bỏ qua kèm lý do
  (`untrusted_sender`, `no_topic_label`, `no_zoom_link`, `message_too_old`, `disabled`),
  theo nhóm — để xác nhận nhóm nào đang trượt vì lý do gì.

## Chi tiết kỹ thuật

- `supabase/functions/_shared/telegram-community.ts`: `detectMeditationInvite`
  (mở rộng nhãn chủ đề, fallback chủ đề, mở rộng regex link, quét nút inline).
- `supabase/functions/telegram-community-webhook/index.ts`:
  `isTrustedMeditationInviteSender` (thêm scope), cửa thời gian, và ghi log lý do bỏ qua
  vào `telegram_ai_audit` kể cả khi skip.
- Migration: thêm cột cấu hình vào `telegram_community_settings`
  (`meditation_summary_sender_scope`, `meditation_summary_max_age_minutes`) kèm GRANT + RLS.
- Admin UI: bổ sung 2 tuỳ chọn trên vào tab lịch thiền + bảng lý do bỏ qua.

## Bước triển khai

1. Bật ghi log lý do bỏ qua (không đổi hành vi) → deploy → thu 1–2 ngày dữ liệu thật.
2. Áp dụng B + C + D (nới nhận diện) và E (chặn trả lời sai về link).
3. Áp dụng A (scope người gửi) + Admin UI.
4. Kiểm thử bằng bộ test Deno với các mẫu lịch thiền thật của từng nhóm.
