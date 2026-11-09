# Phụ đề Việt–Anh để MC đọc thành lời

Nâng cấp hai chế độ (đang chờ review): [Phụ đề trực tiếp và bản MC đọc lại](translator-two-modes.md). Bản MC là luồng biên tập có người rà soát riêng, không thay transcript trực tiếp.

## Thay đổi

- Vẫn dùng AssemblyAI streaming qua Recall và cùng model/AI provider dịch hiện có; không thêm secret, không tăng số lượt gọi AI cho mỗi câu. Không hardcode tiếng Việt cho mọi người nói trong cuộc họp song ngữ.
- Tăng khoảng im lặng tối thiểu từ 200 → 400 ms và tối đa từ 1200 → 1600 ms để bớt cắt lời khi MC ngập ngừng ngắn. Đây là điều chỉnh cần nghiệm thu bằng giọng thật; có thể tăng độ trễ chốt câu. Cơ chế quay lại cấu hình cũ khi Recall từ chối tham số vẫn được giữ.
- Thêm gợi ý nhận giọng: Hoài An, người dẫn chương trình, thuyết trình, lòng biết ơn. Đây là gợi ý từ vựng, không phải luật thay mọi tên nghe gần giống. Giữ nguyên các sửa lỗi nghe sai đã có, không thêm phép thay tên phỏng đoán.
- Prompt dịch dành cho người đọc thành lời: từ thông dụng, giọng gần gũi, chia câu dài thành câu dễ đọc nhưng không lược ý, thêm ý hoặc đoán nốt câu còn dở. Giữ số, phủ định, mức độ chắc chắn và ngôi của người nói.
- Trong cách xưng hô cộng đồng, “bé + tên” dùng tên, không mặc định thành baby/little one hoặc đoán tuổi/giới tính. Nếu nguồn thực sự nói về trẻ sơ sinh thì vẫn dịch nghĩa trẻ sơ sinh. Cha Vũ Trụ → Father Universe; Cha trong ngữ cảnh tâm linh → Father; Thầy → our Teacher khi là danh xưng. Bé đã xác nhận quy ước này trong trao đổi.
- Thêm tối đa hai câu gốc gần nhất của đúng người nói, đúng phiên, trước thời điểm câu hiện tại và không quá 45 giây. Không lấy bản dịch cũ làm kiến thức cho bản dịch mới. Nhãn người nói thiếu hoặc timestamp không hợp lệ thì bỏ qua truy vấn này. Truy vấn ngữ cảnh giới hạn 1 giây; lỗi không được chặn phụ đề.
- Ngữ cảnh giữa các đoạn được kết hợp với các câu trước trong cùng đoạn theo thứ tự nguồn, không phụ thuộc thứ tự hoàn thành dịch song song. Ngữ cảnh tối đa 900 ký tự, tên người nói tối đa 120; câu hiện tại không bị cắt bởi prompt builder.
- Transcript và metadata được đóng gói JSON trong user message; system instruction không nhúng câu người nói. Nội dung cần dịch không được coi là lệnh cho bot. Chỉ xuất bản dịch, không kèm bình luận.
- Không dùng LLM viết lại tiếng Việt gốc; bản dịch lỗi vẫn giữ dòng gốc như hiện tại. Không đổi summary, playback, dedupe hoặc chính sách nhóm. Hai khai báo kiểu kết quả Recall trong playback được sửa theo lỗi `deno check` (không đổi logic).

## Tham chiếu API

- [Recall — AssemblyAI](https://docs.recall.ai/docs/assemblyai): cấu hình `assembly_ai_v3_streaming`, tách nhận giọng khỏi dịch.
- [AssemblyAI — Turn detection](https://www.assemblyai.com/docs/universal-streaming/turn-detection): min/max turn silence ảnh hưởng cách chốt lượt nói. Không tắt semantic endpointing.
- [AssemblyAI — Universal-3.6 languages](https://www.assemblyai.com/blog/universal-3-6-pro-realtime-supported-languages): có tiếng Việt; không suy ra model tài khoản Recall đang dùng chỉ từ danh sách hỗ trợ. Chưa đổi/pin model hoặc gửi `language_codes` chưa được xác minh qua wrapper Recall.

## Ví dụ tham chiếu do người biên tập viết (không phải kết quả gọi Gemini thật)

- “Bé Hoài An sẽ là một trong những người mang đến nhiều thành tựu cho chúng ta hôm nay và trong tương lai.” → “Hoài An will be one of the people helping us achieve great things, today and in the future.”
- “Bây giờ chúng ta cùng nghe một bản nhạc. Sau đó, xin mời Hoài An chia sẻ.” → “Let's enjoy some music together. Then we'll welcome Hoài An to share with us.”
- Không đổi “Cha” thành “our Teacher”, không đổi tên ASR chưa rõ thành tên đoán được. Nếu transcript đã nghe sai tên, cần đối chiếu âm thanh/danh sách tên thật; prompt dịch không thể bảo đảm khôi phục âm thanh đã mất.

## Nghiệm thu trước khi đưa lên production

1. Review/merge nhánh; deploy lại function hiện có `angel-caption`. Không cần migration hay publish frontend cho thay đổi này.
2. Tạo **phiên phụ đề mới** để nhận cấu hình STT/keyword mới; không tự dừng buổi họp đang diễn ra. Cấu hình STT không cập nhật ngược vào bot Recall đã chạy.
3. MC đọc 1–2 phút qua micro thường dùng, có khoảng ngừng ngắn, tên người, “bé”, “Cha”, “Thầy”, số và câu phủ định. Đối chiếu tiếng Việt với âm thanh trước, rồi đối chiếu tiếng Anh với câu gốc. Ghi nhận câu sai và độ trễ chốt/dịch; không hứa tỷ lệ chính xác khi chưa đo.
4. Kiểm tra hai người nói liên tiếp, câu đầu của đoạn mới, chuyển Việt/Anh, câu còn dở và replay webhook. Không lấy ngữ cảnh người khác, không thêm bản dịch trùng, không mất partial trước khi lưu final.
5. Người MC đọc bản tiếng Anh cho người nghe thử: kiểm tra nghĩa, nhịp đọc, tên và đại từ. Chỉ sửa glossary/tên theo danh sách đã xác nhận; không tự động sửa toàn bộ phụ đề cũ.

## Kiểm chứng local

- `bun install --frozen-lockfile` — pass.
- `deno check supabase/functions/angel-caption/index.ts` — pass.
- `deno test --no-lock --node-modules-dir=none --allow-read --allow-env --allow-net supabase/functions/angel-caption` — kiểm thử toàn bộ caption (số lượng trong báo cáo commit).
- `bun test src` — 71 pass, 0 fail.
- `bun run build` — pass.

Chưa gọi Gemini thật với prompt mới, chưa đo WER/độ trễ bằng bản ghi âm MC và chưa deploy nhánh này. Các test mock xác nhận wiring, phân tách dữ liệu, ngữ cảnh, fallback và regression; không chứng minh chất lượng ngôn ngữ của model.
