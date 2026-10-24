# Chẩn đoán và tắt cảnh báo lỗi moderation theo nhóm

## Bước 0 — kết quả trước khi sửa

Audit 7 ngày trên backend production, đọc lúc khoảng 17:45 Malaysia Time ngày 24/10/2026:

| Nhóm | Cảnh báo đã gửi | Lỗi không thể xóa | Tin không tìm thấy |
| --- | ---: | ---: | ---: |
| -1001649798056 — Fun.Rich Camly Community | 109 | 117 | 1 |
| -1003646058428 | 31 | 48 | 1 |
| -1003844072019 | 20 | 95 | 0 |
| -1004309068004 | 17 | 24 | 0 |
| -1002504038861 | 10 | 38 | 0 |
| -1003169690760 | 9 | 30 | 0 |
| -1003730971165 | 4 | 6 | 0 |
| -1003431575368 | 3 | 5 | 0 |
| -1002974118000 | 1 | 1 | 0 |

Số lỗi là sự kiện audit, có thể gồm xử lý lại cùng tin; không phải số tin riêng biệt.

**Nguyên nhân đã xác minh:** Telegram từ chối xóa với category `message_not_deletable` ở cả 9 nhóm; hai nhóm có thêm `message_not_found`. Không thấy category thiếu quyền/lỗi token trong tập lỗi đã phân loại.

**Chưa xác minh:** quyền Xóa tin nhắn của bot hiện tại, tuổi và loại tin gây lỗi. Không thể kết luận thiếu quyền chỉ từ “message can't be deleted”. Chưa sửa rule, cấp quyền hay đổi secret.

## Bước 1 — khắc phục gốc dựa trên bằng chứng

- Kiểm tra quyền bot đúng từng nhóm bằng chức năng kiểm tra quyền hiện có với phiên admin thật; đối chiếu tuổi/loại tin lỗi.
- Nếu xác nhận thiếu quyền: chủ nhóm cấp quyền Xóa tin nhắn; không nới quyền dữ liệu ứng dụng.
- Nếu xác nhận tin không thể xóa: chỉ sửa đường xử lý liên quan và thêm kiểm thử đúng tình huống; không làm yếu bộ lọc hoặc báo xóa thành công giả.
- Hai nhóm có tin không tìm thấy cần đối chiếu ID/lần xử lý để phân biệt đã xóa và lỗi đầu vào.
- Bước này chưa thể hoàn tất khi thiếu snapshot quyền và tin lỗi; không sửa suy đoán để che cảnh báo.

## Bước 2 — tắt cảnh báo trong nhóm, giữ nhật ký

- Thêm `moderation_failure_notice_enabled BOOLEAN DEFAULT false` vào settings; đặt false cho tất cả hàng hiện có, giữ quyền truy cập hiện tại.
- Kiểm tra settings đúng group trước claim/gửi. Tắt → không claim, không gửi, vẫn ghi `moderation_notice_suppressed`; lỗi đọc → không gửi và ghi rõ chưa xác minh được settings.
- Thêm công tắc **Thông báo lỗi moderation trong nhóm** tại khu moderation của nhóm đang chọn; mặc định tắt, lưu và đọc lại để xác nhận.
- Giữ nguyên logic xóa, category lỗi, audit gốc và throttle 5 phút khi bật lại.

## Kiểm thử và vận hành

- Kiểm thử tắt không claim/gửi nhưng vẫn audit; bật giữ dedupe/throttle; nhóm độc lập; lỗi đọc không gửi; lưu boolean đúng nhóm.
- Chạy kiểm thử frontend và Edge Function riêng; kiểm tra lỗi biên dịch.
- Nhóm test thật: bật → tạo lỗi an toàn → có cảnh báo; tắt → vẫn audit nhưng không cảnh báo; tin vi phạm xóa bình thường khi đủ quyền.
- Quan sát 30 phút hoạt động thật sau sửa. Không thay thế bằng test giả lập; không gửi thử vào các nhóm cộng đồng đang hoạt động.
- Cần chủ dự án chỉ định nhóm test và xác minh quyền qua tài khoản admin hiện có. Phiên đăng nhập quản trị tự động không khả dụng với backend external của dự án.

## Chi tiết kỹ thuật

- Cổng gửi chung: `_shared/telegram-community.ts` → `notifyModerationDeleteFailure`, phủ applyViolation, scam-protection và escalation.
- Dùng resolver theo `group_id`, không dùng hàng oldest để quyết định cờ nhóm khác.
- Admin: `TelegramGroupPanel.tsx` và allowlist `telegram-community-admin`; giữ admin gate và kiểm tra đầu vào boolean.
- Migration mới chỉ thêm cột, không chạy lại migration dedupe cũ, không chỉnh generated types bằng tay.
- Báo cáo chi tiết đã lưu tại `docs/operations/telegram-moderation-notices-2026-10-24.md`.