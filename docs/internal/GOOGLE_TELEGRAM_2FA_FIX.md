# Google → Telegram 2FA: sửa luồng callback

## Nguyên nhân

Commit `760c655` thêm xử lý Telegram vào `src/pages/Auth.tsx`, nhưng `/auth` trong `src/App.tsx` tải `src/modules/auth/pages/Auth.tsx`. Màn hình thực tế vẫn chuyển thẳng vào bảng tin. Bản xử lý ở file cũ cũng tiếp tục đăng nhập khi gọi Telegram thất bại.

## Bản sửa

- Đưa callback vào trang auth thực tế; file legacy chỉ re-export cùng trang.
- Đợi phiên Google đến, gọi `telegram-oauth-start` một lần và hiển thị OTP khi backend yêu cầu.
- Lỗi backend hoặc challenge không hợp lệ: kết thúc phiên local, hiển thị lỗi, không chuyển tiếp đăng nhập.
- Guard cho phép callback OAuth tiếp tục khi cờ chấp nhận điều khoản đã được xóa.
- OTP đúng chạy lại bước hoàn tất đăng nhập dùng chung; tài khoản mới vẫn tạo ví custodial.
- Giữ `sso_flow` và `return_to` trong URL quay về từ Google; chỉ chuyển tiếp SSO sau xác thực.
- Không đổi schema hoặc Edge Functions.

## Kiểm tra tự động

`bun test src/utils src/lib tests/auth`: 28 test đạt, gồm 13 test Google/Telegram. Kiểm tra callback thực tế, phiên đến chậm, mất query string, lỗi dịch vụ, challenge thiếu dữ liệu, 2FA tắt, hủy, OTP đúng/sai, guard, SSO và thiết lập tài khoản mới.

ESLint các file thay đổi: đạt.

`bun run build`: đạt; có cảnh báo kích thước bundle lớn của dự án.

`bun test` toàn repo: 28 test đạt, 11 file backend lỗi tải module Deno (`npm:` hoặc URL `deno.land`). Các file bị ảnh hưởng:

- `supabase/functions/lang_test.ts`
- `supabase/functions/_shared/telegram-community.test.ts`
- `supabase/functions/_shared/angel-postprocess.pronoun.test.ts`
- `supabase/functions/_shared/angel-context-bridge.test.ts`
- `supabase/functions/_shared/angel-image-enrich.test.ts`
- `supabase/functions/_shared/telegram-join-guard.test.ts`
- `supabase/functions/_shared/telegramGroup.test.ts`
- `supabase/functions/_shared/angel-image.test.ts`
- `supabase/functions/_shared/telegram-community.spam.test.ts`
- `supabase/functions/live-watchdog-cleanup/zombie_recording_test.ts`
- `supabase/functions/_shared/angel/persona/__tests__/persona-builder.test.ts`

TypeScript toàn ứng dụng bị chặn bởi 5 file test sẵn có thiếu khai báo kiểu `bun:test`: `imageTransform`, `googleAvatarSync`, `mediaNormalization`, `uploadPayload`, `uploadRetry`. Không sửa cấu hình test backend trong thay đổi này.

## Kiểm tra trên bản triển khai

1. Dùng cửa sổ trình duyệt độc lập, không dùng iframe preview Lovable để thử Google OAuth.
2. Tài khoản có Telegram liên kết và 2FA bật: đăng xuất, chọn Google, xác nhận xuất hiện màn hình nhập OTP và nhận mã Telegram.
3. Nhập sai: không vào bảng tin. Nhập đúng: hoàn tất đăng nhập. Hủy: trở về đăng nhập.
4. Thử tài khoản tắt 2FA và tài khoản Google mới; tài khoản mới vẫn chạy thiết lập ví.
5. Kiểm tra đăng nhập từ ứng dụng SSO vẫn quay về đúng ứng dụng.
6. Nếu lỗi bắt đầu xác thực, kiểm tra `telegram-oauth-start` đã triển khai cùng cấu hình Telegram backend. Bản sửa frontend không tự triển khai functions.

Các test mô phỏng phản hồi backend; chưa xác minh việc gửi OTP thật hoặc Google OAuth trên production. Đây là sửa điều phối callback phía giao diện, không nâng phiên Google thành MFA server-side: phiên OAuth được backend cấp trước bước Telegram theo kiến trúc hiện có.
