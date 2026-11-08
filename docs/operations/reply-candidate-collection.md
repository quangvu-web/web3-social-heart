# Tự gom ứng viên trả lời — 09/11/2026 (MYT)

## Trạng thái và phạm vi

Code nâng cấp trên nhánh review; chưa merge/deploy hoặc bật tự gom ở production. Bé đã chọn tự tạo ứng viên, duyệt trước khi bot dùng. Đây là tích lũy FAQ có kiểm duyệt, không huấn luyện model, tự kiểm chứng sự thật, tìm kiếm gần nghĩa hoặc tự mở rộng biến thể.

Không tạo table/function, không sửa RLS/auth/role, không cần migration hay secret mới. Dùng bảng `telegram_approved_replies` và cờ nhóm trong `angel_feature_flags` hiện có. Mọi insert mới vẫn bị trigger hiện có ép thành `draft`.

## Luồng mới

1. Admin → Hội thoại → Thư viện câu trả lời → **Tự gom ứng viên từ hội thoại**. Nhập Group ID và chọn tải cấu hình. Cờ thiếu = tắt; lỗi đọc = báo lỗi và khóa nút, không giả trạng thái tắt.
2. Chọn **Bật tự gom cho nhóm này**. Cờ `library.capture.group.<Group ID âm>` lưu `enabled=true`; không có cờ tổng tự bật mọi nhóm. Update dùng `updated_at` để chống ghi đè cấu hình đồng thời, đọc riêng lại sau khi lưu. Có thể tắt tại đây hoặc trong Feature Flags.
3. Sau khi FUN Core tạo câu trả lời thành công, tác vụ ghi hội thoại nền của webhook xét ứng viên nếu caller xác nhận câu hỏi text độc lập đủ điều kiện. Không thêm chờ vào việc gửi Telegram; không thay quy tắc trigger/quota/cache/FAQ hiện có. Luồng này không xác nhận Telegram đã giao thành công, vì log phản hồi được ghi trước bước giao tin.
4. Bộ lọc chỉ xét nguồn Telegram, group/supergroup, provider FUN Core, không lỗi/retry, không reply và không tự tương tác. Caller loại forward, ảnh, quote, công cụ, translation request và luồng minh họa. Bỏ câu quá ngắn/dài, tiếp nối, nội dung tức thời, link/email/điện thoại/ví/key nhận biết được, tên người hỏi xuất hiện trong câu trả lời, thông báo bận và mã test. Bộ lọc là heuristic: có thể bỏ sót ứng viên tốt hoặc giữ nội dung cần sửa; không bảo đảm phát hiện mọi dữ liệu cá nhân hay chứng minh câu trả lời đúng.
5. Chỉ nhận ngôn ngữ `vi/en` có nội dung phù hợp bộ kiểm tra đơn giản; thiếu metadata/mâu thuẫn ngôn ngữ thì bỏ qua. Không đoán dịch. Nhóm ép Anh nhưng log ngôn ngữ vẫn là Việt có thể bị bỏ qua, dùng biên tập thủ công khi cần.
6. Đọc mới cờ đúng nhóm mỗi lần, timeout 1 giây; lỗi/thiếu/tắt không ghi. Tra mục đã có theo nhóm, ngôn ngữ, câu hỏi chuẩn hóa và aliases (kể cả thu hồi/hết hạn); không ghi đè hay phục hồi chúng. ID ứng viên xác định từ nhóm/ngôn ngữ/câu hỏi; các worker/quét đồng thời dùng cùng khóa chính, duplicate không update nội dung. Từng query lưu/tra có timeout 1 giây. Không log nội dung câu hỏi/đáp trong lỗi của bộ gom.
7. Tạo bản nháp cùng nhóm nguồn, aliases rỗng, lưu ID hội thoại nguồn, hạn 30 ngày kể từ lúc gom. Không tạo mục dùng chung, không tự chuyển sang approved. Không tự xóa hoặc dọn ứng viên cũ.
8. Bé bấm **Tải lại thư viện**, đọc/biên tập → lưu nháp → duyệt riêng. Chỉ sau duyệt mới có thể được bot dùng theo quy tắc FAQ hiện tại. Bộ lọc không thay thế người duyệt.

## Lấy ứng viên từ lịch sử

Chọn nhóm rồi bấm **Quét lịch sử và tạo bản nháp (tối đa 100 lượt)**. Quét tối đa 100 lượt FUN Core thành công gần nhất trong 30 ngày của đúng nhóm; bỏ reply/DM và áp dụng cùng bộ lọc. Có thể quét dù tự gom lượt mới đang tắt. Đây là một lần quét khi bấm, không phải cron quét toàn bộ lịch sử. Quét lại không ghi đè mục trước. Số quét/qua lọc/tạo/bỏ trùng được báo riêng. Nếu lỗi giữa chừng, báo số đã tạo, giữ kết quả đã lưu và cho phép chạy lại; không giả rollback hay danh sách rỗng.

Lịch sử cũ chưa chứa đủ metadata để chứng minh câu gốc không liên quan ảnh/forward/công cụ. Mọi kết quả quét vẫn cần kiểm tra nguồn/ngữ cảnh trước khi duyệt. Không thu thập DM hoặc đưa dữ liệu sang dịch vụ AI ngoài; không phát sinh call Gemini/FUN Core để chấm điểm.

## Triển khai và nghiệm thu

1. Review và merge code; deploy lại function hiện có `telegram-community-webhook`; Publish frontend sau review. Không chạy migration nguồn thư viện cũ, không cần migration mới. Không cần redeploy `angel-caption` chỉ vì import shared được thêm (tính năng không được bật ở caller caption).
2. Admin đăng nhập thật, chọn một nhóm thử. Kiểm tra thiếu cờ là tắt, lỗi tải có thông báo, reload vẫn khớp cờ DB. Bật đúng một nhóm, giữ nhóm khác tắt.
3. Gửi câu hỏi độc lập đủ dài bằng trigger phù hợp để FUN Core trả lời; xác minh hội thoại thành công có ID nguồn và bản nháp đúng nhóm, ngôn ngữ, hạn; lúc này bot chưa được dùng bản nháp.
4. Thử DM, ảnh, reply, công cụ, câu bận và thông tin cá nhân nhận biết được: không có ứng viên tự động. Tắt cờ → các lượt sau khi cờ tắt được đọc không tạo ứng viên. Lượt đang xử lý có thể đã đọc cờ bật trước thao tác tắt.
5. Quét lịch sử hai lần, kiểm tra không tăng bản trùng. Biên tập/thu hồi một ứng viên rồi quét lại: không đổi nội dung/trạng thái. Trùng câu hỏi nhưng khác nhóm/ngôn ngữ vẫn tách biệt. Cấu hình concurrent edit phải yêu cầu tải mới.
6. Duyệt một FAQ và hỏi lại; log `approved_library` xác minh được dùng, không gọi AI cho lượt hit. Thu hồi vẫn có hiệu lực theo luồng cũ. Chưa nghiệm thu live bằng việc test mock.

Rollback vận hành: tắt cờ nhóm, thu hồi FAQ không phù hợp; bản nháp giữ lại cho admin rà soát. Không xóa bảng hoặc thay đổi quyền. Nên chỉ bật một nhóm trước và kiểm tra dung lượng bản nháp định kỳ vì chưa có quota lưu tự động hoặc tác vụ dọn dữ liệu.

## Kiểm chứng local

- `bun install --frozen-lockfile`, `bunx tsc --noEmit -p tsconfig.app.json`, `bun run build`: pass.
- `bun test src`: 75 pass, 0 fail, gồm 4 test trạng thái admin, đọc lỗi, CAS và phạm vi quét.
- `deno check` cho `telegram-community-webhook/index.ts` và `angel-caption/index.ts`: pass.
- Deno test bộ gom, FAQ hiện có, caption routing/operators và DM text context: 29 pass, 0 fail, gồm logger thật với database giả, chặn lưu khi log thất bại và ID nguồn đúng.
- Chưa xác minh preview admin có đăng nhập, cờ/database production hoặc tự gom/duyệt/hit Telegram thật. Kiểm thử mock không chứng minh chất lượng nội dung, độ đầy đủ bộ lọc hay quyền production.
