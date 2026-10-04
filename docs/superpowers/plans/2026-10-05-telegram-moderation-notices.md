# Kế hoạch điều tra và chống lặp cảnh báo moderation

**Mục tiêu:** Giữ kết quả moderation trung thực, giới hạn thông báo lỗi xóa bằng khóa DB nguyên tử, không thay detector khi chưa có bằng chứng.
**Phạm vi:** Yêu cầu trong phiên ngày 2026-10-05; group cần đối chiếu -1001649798056. Chỉ local, không push/deploy/chạy migration production.

- [x] Truy dấu applyViolation, escalation, scam protection và các ngoại lệ văn bản/OCR; chỉ đọc metadata production khi xác minh đúng project và khoảng thời gian.
- [x] Viết test lỗi quyền, mạng, response, giới hạn Telegram; test thông báo concurrent/retry/cooldown và nội dung FUN hợp lệ hiện có.
- [x] Thêm helper delete outcome và thông báo: claim qua RPC, ghi audit metadata; không gửi nếu claim không xác minh được, không retry gửi khi kết quả không chắc chắn.
- [x] Đề xuất SQL riêng ngoài migrations: event unique (group, message, kind), row lock group cho rolling cooldown, RLS, chỉ service_role được gọi. Chạy fixture SQL trên PostgreSQL tạm local, gồm hai kết nối cạnh tranh.
- [x] Tích hợp các nhánh cảnh báo xóa thất bại; giữ action/rule gốc và mã lỗi, không lưu raw Telegram description trong log mới.
- [x] Chạy bun test và deno test riêng, rà diff/check và báo giới hạn vận hành. Không sửa file auto-generated hoặc dữ liệu production.

Rủi ro cần kiểm: RPC thiếu/lỗi phải có audit và không spam; crash sau claim có thể mất thông báo nhưng vẫn giữ lỗi; retry không tạo thông báo mới sau cooldown; group khác độc lập; thành công ban nhưng thất bại xóa vẫn ghi đủ kết quả. Không hứa exactly-once delivery tới Telegram.

Chi tiết bằng chứng, kiểm thử thất bại và giới hạn production: `docs/operations/telegram-moderation-warning-investigation.md`.
