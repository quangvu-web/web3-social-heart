# Chặn tin nhắn "mồi" tiếng Trung trong nhóm

## Phân tích: đây có phải scam không?

Có. 4 tin trong ảnh (`今天要加鸡腿咯`, `比银行香万倍`, `失误也能搞`, `五五分账合作`) là **mồi tạo bằng chứng xã hội** (social-proof seeding) — chiêu quen thuộc của các nhóm lừa đảo "刷单 / 代付 / 收米":

- "今天要加鸡腿咯" — khoe "hôm nay kiếm thêm được, ăn mừng".
- "比银行香万倍" — "lãi hơn ngân hàng vạn lần".
- "失误也能搞" — "sai sót cũng ăn được" (mồi kiểu kèo chắc thắng).
- "五五分账合作" — **"hợp tác chia 5-5"**, câu chốt kèo rõ ràng nhất.

Các tài khoản (Sierra Jones, Pamela Peterson — tên Tây, chat tiếng Trung) nhả từng câu ngắn, cách nhau vài chục phút, để tạo cảm giác "có người đang kiếm tiền thật" trước khi kéo nạn nhân sang DM. Nhóm là cộng đồng tiếng Việt, nên chat tiếng Trung thuần túy ở đây gần như luôn là spam.

## Vì sao bot hiện tại không chặn

Bộ lọc `looksLikeCjkPromo` yêu cầu match từ khóa quảng cáo dài (代付, 三方通道, 抖币, 收入3500+...). Những câu trên **quá ngắn và không chứa từ khóa nào**, cũng không có link/mention nên mọi detector hiện có đều bỏ qua.

## Kế hoạch xử lý

### 1. Thêm từ khóa mồi mới (bắt ngay lập tức)
Bổ sung vào `CJK_PROMO_PATTERNS`: `五五分账`/`分账合作`/`几几分账`, `比银行香`/`香万倍`, `加鸡腿`, `失误也能搞`/`稳赚不赔`, `躺赚`, `带你飞`, `跟我做`, `日入`/`月入` + số, `无门槛`, `包回本`.

### 2. Detector mới: "CJK chatter" trong nhóm tiếng Việt
Hàm `looksLikeOffLanguageCjkChatter(text)`:
- Tin ngắn (≤ 30 ký tự), **≥ 70% ký tự là CJK**, không phải tiếng Việt/Anh.
- Bỏ qua nếu chỉ là emoji, số, hoặc câu chào ngắn (`你好`, `谢谢`).

Một tin đơn lẻ **chưa xóa ngay** — chuyển sang bước 3 để tránh chặn nhầm thành viên Trung Quốc thật.

### 3. Chấm điểm tích lũy theo người gửi (chống mồi rải rác)
Bảng đếm nhẹ trong bộ nhớ + `telegram_ai_audit`:
- Mỗi tin CJK-chatter của cùng một user trong nhóm tiếng Việt cộng 1 điểm, cửa sổ 24 giờ.
- **≥ 2 điểm** → xóa các tin đó, cảnh báo user.
- **≥ 3 điểm**, hoặc bất kỳ tin nào match từ khóa ở bước 1 → xóa + ban ngay (giống xử lý `automated_cjk_scam` hiện tại).
- Thành viên đã được whitelist/admin thì miễn trừ.

### 4. Cấu hình cho admin
Thêm cờ trong `telegram_community_settings`:
- `cjk_chatter_guard_enabled` (mặc định BẬT)
- `cjk_chatter_strike_threshold` (mặc định 2)
- `group_primary_language` (mặc định `vi`) — chỉ áp dụng guard khi nhóm không phải nhóm tiếng Trung.

### 5. Kiểm thử
Thêm test vào `telegram-community.spam.test.ts`:
- 4 câu trong ảnh → đều bị nhận diện.
- `大家好，今天我们一起冥想吧` (câu lành tính) → KHÔNG bị chặn.
- Tin tiếng Việt có xen chữ Hán (ví dụ trích thơ) → KHÔNG bị chặn.

## Chi tiết kỹ thuật
- Sửa: `supabase/functions/_shared/telegram-community.ts` (patterns + detector mới).
- Sửa: `supabase/functions/telegram-community-webhook/index.ts` (tích hợp strike counter, hành động xóa/ban).
- Migration: thêm 3 cột cấu hình vào `telegram_community_settings`.
- Admin UI: 3 ô cấu hình trong tab bảo mật Telegram.
- Không đụng tới bot Telegram 2FA.
