# Chẩn đoán trạng thái webhook Admin

Branch: `feature/telegram-webhook-diagnostics`, base local main `6e3e011`.

## Đã xác nhận từ code và test

- Transport cũ gộp lỗi và không có deadline; safe status mất nguyên nhân và giai đoạn.
- `verified` cũ là true khi dữ liệu hợp lệ, dù sai endpoint/thiếu updates.
  Regression test đã thất bại (6 pass, 1 fail) trước sửa, pass sau sửa.
- UI cũ không giữ riêng setWebhook thành công/getWebhookInfo thất bại.
- Diagnostic mới chỉ log `{stage, code}`; không đưa lỗi raw, URL, body vào response/log.
  Request có timeout 10 giây cho mỗi bước, kể cả khi đọc body.
- `get_webhook_info` chỉ gọi getWebhookInfo. Không tự đăng ký hoặc xóa webhook.
- Đăng ký yêu cầu HTTP thành công, `ok:true`, `result:true`; sau đó đọc trạng thái.
  Set thành công/get thất bại trả `webhook_registered_unverified` và `cause_code`.
- Chỉ verified khi endpoint khớp và đủ message/chat_member/callback_query.
- Trường allowed_updates thiếu/rỗng được xem theo mặc định Telegram: thiếu chat_member.
  Danh sách khác không bị biến thành danh sách mặc định khi làm sạch dữ liệu.
- Giữ drop_pending_updates=false. Action cũ clear_webhook_error được chuyển sang
  đăng ký lại, không còn deleteWebhook; UI ghi rõ Đăng ký lại webhook, không báo đã xóa lỗi.
- Trạng thái webhook áp dụng cho bot, không riêng nhóm đang chọn.

Nguồn mặc định updates: https://core.telegram.org/bots/api#setwebhook

## Kiểm tra đã chạy

```sh
bun test src/components/admin/telegramWebhookStatus.test.ts src/components/admin/telegramWebhookDiagnostic.test.ts
```

9 pass, 0 fail. Kiểm tra thông báo, mã lỗi/giai đoạn, phản hồi cũ, dữ liệu không hợp lệ
và loại bỏ thông báo SDK/HTTP có thể chứa secrets. Đây là unit tests của presenter;
chưa chạy kiểm thử tương tác trình duyệt với phiên admin.

```sh
deno test --no-config --no-lock --node-modules-dir=none --cached-only --deny-net supabase/functions/_shared/telegram-webhook-config.test.ts supabase/functions/_shared/telegram-webhook-diagnostics.test.ts supabase/functions/_shared/telegram-transport.test.ts
```

18 pass, 0 fail; typecheck các module/test này pass. Mock fetch, không quyền env/mạng,
không dùng no-check. Lệnh dùng dependency cache, không xác nhận frozen lockfile.

```sh
./node_modules/.bin/tsc -p tsconfig.app.json --noEmit
```

Pass. Worktree dùng symlink node_modules đã cài ở repo gốc, không cài/update dependency.

```sh
deno check --no-config --no-lock --node-modules-dir=none --cached-only supabase/functions/telegram-community-admin/index.ts
```

Fail: 11 lỗi legacy, cũng xuất hiện trên bản gốc 6e3e011:
4 FlagKey không hợp lệ, 4 tên biến chưa khai báo trong code AI dùng chung,
3 truy cập description/result sai cấp ở các action moderation/member của admin.
Không sửa các lỗi ngoài phạm vi này. Không tuyên bố toàn function typecheck pass.

`git diff --check`: pass.

## Còn cần người vận hành kiểm tra

Chưa xác nhận nguyên nhân runtime của nhóm -1004298473783. Không đọc secrets,
không gọi API Telegram, không thay production trong tác vụ này.

Sau khi bản sửa được review và triển khai theo một ủy quyền riêng:

1. Kiểm tra phiên bản frontend/function và sự hiện diện của các biến môi trường cần thiết
   trong bảng quản trị backend, không sao chép giá trị vào log/chat.
2. Bấm Tải lại trạng thái (chỉ đọc), ghi lại code, cause_code và stage.
3. `bot_token_missing`/`webhook_secret_missing`: người vận hành kiểm tra cấu hình tương ứng.
   `telegram_transport_failed`: kiểm tra timeout/kết nối outbound.
   `telegram_api_rejected`: kiểm tra token/quyền/cấu hình bằng công cụ an toàn, không log URL/body.
   `telegram_response_invalid`: kiểm tra phiên bản function/transport.
4. Nếu đọc thành công nhưng endpoint/update sai, chỉ chủ động đăng ký khi được phép;
   không suy ra cần đăng ký lại từ một lần đọc lỗi.
5. Chỉ kết luận cấu hình đã xác minh khi endpoint_matches=true và đủ updates.
   Điều này chưa chứng minh Telegram thực sự giao chat_member cho một lần join cụ thể;
   cần runtime log tương ứng riêng.

Không commit/push/merge/deploy, migration hoặc thay dữ liệu production.
