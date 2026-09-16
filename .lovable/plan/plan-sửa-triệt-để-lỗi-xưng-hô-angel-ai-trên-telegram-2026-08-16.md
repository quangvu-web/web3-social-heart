# Plan sửa triệt để lỗi xưng hô Angel AI trên Telegram

## Kết luận điều tra

Lỗi không phải do một prompt bị bỏ sót đơn lẻ, mà do **quy ước xưng hô đang mâu thuẫn giữa nhiều lớp**:

1. `PRONOUN_SUBJECT_RULE` và prompt hậu xử lý hiện quy định bot tự xưng ngôi ba là **“Angel”**, không phải **“mình”**.
2. `enforceVietnamesePronouns()` ở cuối luồng chủ động đổi gần như mọi **“mình” → “Angel”**. Đây là nguyên nhân trực tiếp tạo các câu sai như “kiến thức Angel có”, “Sách không tự nhận Angel là…”. Danh sách bảo vệ phản thân chỉ bao phủ một số mẫu nên không thể bắt hết ngữ nghĩa tiếng Việt.
3. `applyLayerBSurfaceRewrite()` tiếp tục áp dụng hợp đồng cũ “mình/bạn → Angel/bé”, làm lỗi có thể được tạo lại sau khi model đã trả lời đúng.
4. Nhánh FUN Core strict mirror cố ý chỉ gửi câu user cuối và loại toàn bộ system prompt cục bộ. Vì vậy prompt xưng hô của FUN Profile không hề tới Angel gốc; kết quả chỉ còn phụ thuộc vào lớp sửa cuối luồng.
5. Nhánh DM ngắn dưới 400 ký tự bỏ qua style pass và hard-revert tổng quát. Nhánh factual cũng có thể bỏ qua hậu xử lý. Vì thế cùng một câu hỏi có lúc đúng, lúc sai tùy route và độ dài.
6. Một số few-shot, fallback và câu gợi ý hardcode vẫn dạy cách nói ngôi ba như “Bé muốn Angel đi sâu…”, tiếp tục củng cố hành vi cũ.
7. Bộ test hiện tại chủ yếu bảo vệ các cụm đã biết (`vai Angel`, `hòa Angel`…), nhưng chưa có test cho mẫu tổng quát như “kiến thức Angel có”, “Angel có để mở rộng”, “Sách không tự nhận Angel là…”.

## Quy ước xưng hô chuẩn mới

- Khi trò chuyện tự nhiên bằng tiếng Việt, bot tự xưng **“mình”** và gọi người dùng là **“bé”**.
- Chỉ giữ **“Angel”** khi đó là tên riêng/định danh: “Mình là Angel”, “bot Angel AI”, “Angel AI gốc”, tiêu đề hoặc nội dung đang nói *về* Angel.
- Trong lời thoại nhân vật, giữ đại từ tự nhiên của nhân vật; không ép “Angel/bé”.
- Owner mode giữ cách gọi người gửi là **“Cha”**, nhưng bot vẫn tự xưng **“mình”** nếu không có yêu cầu riêng khác.
- Không sửa nội dung trong URL, mã, địa chỉ ví, handle, trích dẫn nguyên văn hoặc dữ liệu RAG cần bảo toàn.

## Các bước triển khai

### 1. Tạo một Pronoun Contract duy nhất

- Đưa quy ước mới vào một module canonical dùng chung cho Telegram persona, local fallback và post-process.
- Sửa `PRONOUN_SUBJECT_RULE`, style prompt và các prompt retry để cùng một nghĩa: **mình ↔ bé**.
- Giữ rule riêng cho tên riêng “Angel” và lời thoại nhân vật.

### 2. Thay bộ chuyển đại từ gây lỗi

- Loại bỏ phép đổi tổng quát `mình → Angel` trong `enforceVietnamesePronouns()`.
- Thu hẹp `applyLayerBSurfaceRewrite()` để chỉ chuẩn hóa cách gọi user `bạn → bé` khi chắc chắn là đại từ; không thay “mình”.
- Bổ sung validator cuối luồng phát hiện **Angel bị dùng như đại từ sở hữu/chủ thể trải nghiệm**, nhưng chỉ sửa khi cấu trúc đủ chắc chắn; trường hợp mơ hồ giữ nguyên thay vì đoán.
- Hợp nhất lớp hard-revert hiện có vào cùng pipeline, tránh nhiều bộ regex chạy chồng chéo và tái tạo lỗi.

### 3. Bắt buộc mọi nhánh đi qua cùng cổng an toàn

Áp dụng deterministic pronoun guard ngay trước khi gửi Telegram cho tất cả các route:

- FUN Core strict mirror.
- Lovable AI/local fallback.
- DM ngắn dưới 400 ký tự.
- Factual bypass.
- Interpret retry, anti-repeat retry, language repair.
- Các câu fallback/hardcode và phản hồi owner mode.

Style pass bằng AI vẫn có thể tắt để tiết kiệm credit; pronoun guard deterministic luôn chạy và không tốn credit.

### 4. Dọn prompt và nội dung hardcode mâu thuẫn

- Đổi các few-shot/follow-up/fallback tự xưng ngôi ba sang “mình”.
- Không sửa các chỗ “Angel” là tên thương hiệu hoặc định danh thật.
- Cập nhật mô tả trong Admin Persona để admin không vô tình lưu override theo hợp đồng cũ.
- Khi override cũ chứa quy tắc “bot tự xưng Angel”, hiển thị cảnh báo tương thích thay vì âm thầm tiếp tục áp dụng.

### 5. Thêm kiểm thử hồi quy theo ma trận

Kiểm thử tối thiểu cho cả DM/group, short/long, mirror/local, factual/retry và owner mode:

- “Sách không tự nhận mình là một phương pháp…”
- “…kiến thức mình có để mở rộng…”
- “Mình nghĩ bé nên…”
- “Mình là Angel…”
- “Angel AI là bot của FUN Profile…”
- Các cụm phản thân: “hòa mình”, “chính mình”, “của mình”, “bạn bè”.
- Lời thoại nhân vật không bị thay đại từ.
- URL, ví, handle và trích dẫn nguyên văn không bị sửa.
- Chạy pipeline hai lần phải cho cùng kết quả (idempotent).

### 6. Telemetry và triển khai an toàn

- Ghi telemetry đếm số lần validator sửa một câu, route sinh câu đó và mẫu lỗi; không lưu thêm dữ liệu nhạy cảm.
- Đặt feature flag cho Pronoun Contract mới để rollback nhanh nếu có sai lệch.
- Triển khai function liên quan, chạy test hồi quy và kiểm tra thực tế bằng một bộ câu hỏi Telegram đại diện trước khi kết luận hoàn tất.

## Phạm vi file dự kiến

- `supabase/functions/_shared/angel-facts.ts`
- `supabase/functions/_shared/angel-postprocess.ts`
- `supabase/functions/_shared/telegram-community.ts`
- Các test pronoun/context liên quan
- Admin Persona UI chỉ khi cần hiển thị contract/cảnh báo override
- Tài liệu `docs/internal/ANGEL_PROMPT_MAP.md`

## Không thay đổi

- Không thay đổi nội dung RAG/knowledge hoặc cơ chế truy xuất tri thức.
- Không đổi model hay provider.
- Không thêm AI call mới; lớp bảo vệ chính là deterministic để không tăng credit.
- Chưa triển khai cho đến khi bé duyệt plan.
