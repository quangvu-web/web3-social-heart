# Kế hoạch sửa duplicate bot invite

Mục tiêu: tối đa một notice và một leave attempt mỗi lần mời bot vào nhóm chưa quản lý; giữ lỗi settings và nhóm managed riêng biệt. Yêu cầu trong phiên là phạm vi thực thi; không có thao tác production.

- [x] Kiểm tra Git sạch, branch riêng; truy dấu mọi notice/leave và cơ chế inline/background.
- [x] Xác minh contract my_chat_member trong đăng ký/handler và Bot API; yêu cầu readiness/preflight production trước phát hành.
- [x] Test-first helper transition/claim; thêm fixture HTTP qua handler thật và PostgreSQL nhiều kết nối.
- [x] Dùng luồng my_chat_member chính, bỏ side effects nhánh thứ cấp; claim event độc lập, không dùng cooldown moderation.
- [x] Tạo migration mới có RLS/GRANT + preflight, chỉ thử trên database local tạm.
- [x] Chạy frontend/Edge riêng, đối chiếu legacy với HEAD, review độc lập, diff check và secret scan. Không push/deploy.

Thiết kế, bằng chứng, giới hạn và lệnh kiểm thử: `docs/operations/telegram-unauthorized-invite-idempotency.md`.
