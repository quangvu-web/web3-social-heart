# Chẩn đoán cảnh báo lỗi xóa — 24/10/2026, Malaysia Time

## Phạm vi và nguồn

Đọc metadata audit trực tiếp từ backend đã kết nối `xoiceivuqbxnmpfdiklg`, khoảng 7 ngày trước thời điểm truy vấn 17:45 MYT ngày 24/10/2026. Không đọc nội dung tin, username, token; không gửi/xóa tin thử, không thay quyền bot, secret hoặc cấu hình Telegram. Chỉ thống kê các action và nhóm lỗi được allowlist. Số sự kiện là số row audit, không phải số tin vi phạm duy nhất; retry có thể sinh thêm row.

## Bước 0 — nhóm có cảnh báo

| Group ID | Cảnh báo đã gửi | Sự kiện message_not_deletable | Sự kiện message_not_found |
| --- | ---: | ---: | ---: |
| -1001649798056 (Fun.Rich Camly Community) | 109 | 117 | 1 |
| -1003646058428 | 31 | 48 | 1 |
| -1003844072019 | 20 | 95 | 0 |
| -1004309068004 | 17 | 24 | 0 |
| -1002504038861 | 10 | 38 | 0 |
| -1003169690760 | 9 | 30 | 0 |
| -1003730971165 | 4 | 6 | 0 |
| -1003431575368 | 3 | 5 | 0 |
| -1002974118000 | 1 | 1 | 0 |

Tổng 204 cảnh báo đã gửi, 364 sự kiện message_not_deletable và 2 message_not_found. Các sự kiện có thể bao gồm delete_failed, scam_detected_delete_failed, moderation_failed và automated_scam_action_failed.

## Nguyên nhân đã chứng minh và chưa chứng minh

- Cả 9 nhóm đều có lỗi chủ đạo `message_not_deletable`: Telegram trả nội dung được bộ phân loại nhận diện là "message can't be deleted". Đây là từ chối xóa, không phải lỗi cảnh báo chạy vô cớ.
- Hai nhóm có thêm `message_not_found`: Telegram báo không tìm thấy tin tại thời điểm xóa. Chưa chứng minh tin bị một bot khác xóa hay ID sai.
- Không thấy category `permission_denied`, `configuration_unavailable`, `transport_error`, `telegram_error` hoặc `invalid_response` trong tập sự kiện lỗi đã phân loại của khoảng này. Điều này không thay thế việc xác minh quyền bot hiện tại và không loại trừ thiếu quyền nếu Telegram trả description chung.
- Chưa có snapshot `getChatMember` hiện tại hoặc timestamp gốc của tin để xác định thiếu quyền, tin quá hạn hay loại tin không thể xóa. Audit category không đủ để chọn sửa rule/cấp quyền/token.
- Không có Telegram workspace connector khả dụng để thực hiện chẩn đoán qua connector; endpoint admin hiện có `check_delete_permission` có thể kiểm tra bằng phiên admin thật, chưa được gọi trong phiên này.

## Hành động khắc phục theo từng nhóm

Áp dụng cho mỗi hàng trong bảng: kiểm tra đúng bot `funrich_community_bot`, trạng thái quản trị viên và quyền Xóa tin nhắn bằng chức năng kiểm tra quyền đã có; đối chiếu message ID, tuổi tin và loại tin ở các lần lỗi. Nếu snapshot xác nhận thiếu quyền, chủ nhóm cấp quyền Xóa tin nhắn; nếu xác nhận tin không thể xóa/quá hạn, chỉ sửa đường xử lý đã chứng minh và bổ sung fixture tương ứng. Không đổi token khi chưa có lỗi cấu hình/credential.

Riêng -1001649798056 và -1003646058428: đối chiếu thêm hai sự kiện message_not_found trước khi kết luận trùng xử lý hoặc ID sai. Không chuyển lỗi này thành xóa thành công giả.

Hành động đã làm: đọc và tổng hợp audit, truy dấu ba nhánh gửi cảnh báo, xác nhận resolver settings theo group_id và chỗ đặt công tắc quản trị. Chưa sửa nguyên nhân vì chưa có bằng chứng chọn biện pháp an toàn; không cấp thêm quyền hoặc thay detector suy đoán.

## Bước 2 dự kiến

Thêm cờ theo từng nhóm, mặc định false cho mọi hàng cũ/mới. Đọc đúng settings của nhóm trước claim; false/không có cờ thì ghi moderation_notice_suppressed và không claim/gửi; lỗi đọc thì không gửi, ghi audit không xác minh được. Giữ audit xóa gốc, category và throttle 5 phút khi bật. Công tắc quản trị đi qua admin endpoint/guard hiện tại, kiểm tra boolean và group_id, lưu rồi đọc lại.

## Nghiệm thu chưa thực hiện

## Triển khai sau phê duyệt

Cột đã thêm và mặc định false đã đọc lại từ production; migration đặt false cho mọi hàng hiện có, không đổi policies/grants. Cổng gửi đọc settings theo group trước claim, thiếu cờ/hàng hoặc lỗi đọc đều không gửi và vẫn audit. Công tắc đã thêm trong khu anti-spam, endpoint kiểm tra boolean/group_id và đọc lại hàng sau lưu. Webhook deployed source SHA b17cbe3ab7a037046019fcd16effec08ffac53015efa94dc9c67144e1a04afbb; admin SHA 459c3c3209e2230bb88340e01d6809c1e6dd40a4692fb323e65ecae6f500da06. Frontend chưa publish trong phiên này.

Kiểm thử: Bun tải cài đặt nhóm 1/1; Deno helper 7/7 có type checking; applyViolation integration 1/1 với --no-check, toàn bộ fetch mock và không cho phép network. Build log OK. Các kết quả không thay thế nghiệm thu nhóm thật. 44 linter findings có sẵn, migration không thêm finding.

Chưa có 30 phút hoạt động sau sửa, chưa bật/tắt trên nhóm test thật, chưa xóa tin thử hoặc xác minh quyền bot. Cần nhóm test do chủ dự án chỉ định và phiên admin/kiểm tra quyền thật; không tạo lỗi hoặc gửi cảnh báo vào nhóm cộng đồng để thử.