# Sửa lỗi: đăng nhập Google có bật 2FA Telegram nhưng không hiện ô nhập OTP

## Vấn đề

Khi bé bật xác thực 2 lớp qua Telegram rồi đăng nhập bằng Google, bot Telegram không gửi mã và màn hình nhập mã 6 số không hiện ra — người dùng vào thẳng trang chủ, tức là bước bảo vệ bị bỏ qua.

## Nguyên nhân (đã kiểm chứng trong mã nguồn)

Dự án hiện có **hai bản trang Đăng nhập**:

- `src/pages/Auth.tsx` — bản **có đầy đủ** logic 2FA Telegram cho Google (gọi `telegram-oauth-start`, hiện ô nhập OTP). Nhưng bản này **không được dùng**.
- `src/modules/auth/pages/Auth.tsx` — bản **đang thực sự chạy** (được khai báo trong `src/App.tsx` cho đường dẫn `/auth`). Bản này **không có** bước kiểm tra 2FA: thấy có phiên đăng nhập là chuyển thẳng về trang chủ.

Vì vậy sau khi Google trả về, ứng dụng không bao giờ yêu cầu bot Telegram tạo mã → bot "im lặng".

Phụ thêm: cờ đánh dấu `google_oauth_2fa_pending` được đặt lúc bấm nút Google nhưng bản trang đang chạy không bao giờ xoá nó, nên có nguy cơ bị chuyển hướng lặp về `/auth`.

## Cách sửa

1. Chuyển toàn bộ logic 2FA Telegram từ bản không dùng sang **bản trang Đăng nhập đang chạy** (`src/modules/auth/pages/Auth.tsx`):
   - Nhận biết lần quay về từ Google (tham số `oauth_callback=google` hoặc cờ đang chờ 2FA).
   - Gọi chức năng máy chủ `telegram-oauth-start` để bot gửi mã 6 số.
   - Nếu tài khoản có bật 2FA: hiện màn hình nhập mã (thành phần `TelegramOtpChallenge`), tạm thoát phiên cục bộ cho tới khi nhập đúng mã.
   - Nếu không bật 2FA: vào thẳng trang chủ như hiện tại.
2. Luôn xoá cờ `google_oauth_2fa_pending` ở mọi nhánh (thành công, không bật 2FA, lỗi) để tránh chuyển hướng lặp.
3. Khi gọi máy chủ thất bại (mất mạng, bot lỗi): hiện thông báo tiếng Việt rõ ràng và **không** cho vào thẳng trang chủ một cách âm thầm; cho phép thử lại.
4. Gỡ bản trang trùng lặp `src/pages/Auth.tsx` khỏi vai trò "nguồn thứ hai" (không còn được import ở đâu) để sau này không lặp lại lỗi này.

## Chi tiết kỹ thuật

- Route `/auth` trong `src/App.tsx` trỏ tới `@/modules/auth/pages/Auth` — đây là tệp cần sửa.
- Luồng máy chủ đã sẵn sàng, không cần đổi: `telegram-oauth-start` → `createTelegramChallenge()` (trong `supabase/functions/_shared/telegram.ts`) → gửi tin nhắn bot → `telegram-2fa-verify` trả về access/refresh token.
- `telegram-oauth-start` cần JWT của người dùng (`requireTelegramUser`), nên phải gọi **sau khi** Google đã tạo phiên và **trước khi** thoát phiên cục bộ.
- Sau khi nhập mã đúng, dùng `supabase.auth.setSession()` với token do `telegram-2fa-verify` trả về (giống luồng ví và email OTP hiện có).
- Không đổi cấu hình Google OAuth, không đổi cơ sở dữ liệu, không đụng tới các secret.

## Kiểm thử

- Tài khoản **có** bật 2FA Telegram: đăng nhập Google → bot gửi mã → nhập mã → vào trang chủ với phiên hợp lệ.
- Tài khoản **không** bật: đăng nhập Google → vào thẳng trang chủ, không có bước thừa.
- Nhập sai mã: báo lỗi, còn bao nhiêu lần thử; hết hạn 5 phút: báo hết hạn.
- Kiểm tra kiểu dữ liệu và chạy thử giao diện trước khi báo hoàn tất.
