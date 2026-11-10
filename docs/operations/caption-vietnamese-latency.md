# Phụ đề Việt–Anh: nhận giọng và thời gian hiện câu

## Bằng chứng trước thay đổi — 10/11/2026, Malaysia (UTC+8)

Đọc công khai phiên `fnm3ccckp6sh`: đã kết thúc, 1.203 dòng; hệ thống gắn nhãn 166 dòng Việt và 1.037 dòng Anh; không thiếu bản dịch ở các dòng này. Trung vị `(created_at - started_at) - ts_offset_sec`: Việt 9,395 giây, Anh 5,864 giây. Độ dài nguồn trung vị tương ứng 48 và 13 ký tự.

Đây là khoảng từ đầu câu tới insert theo mốc phiên, **không phải độ trễ dịch riêng hay độ trễ từ cuối lời nói**. Độ dài câu, độ lệch mốc khởi động và heuristic gắn nhãn ngôn ngữ có thể ảnh hưởng. Không suy ra WER hay khẳng định nguyên nhân nhận sai khi chưa có âm thanh và bản chép chuẩn. Chưa lấy được cấu hình Recall thực tế của bot phiên này; không khẳng định model cũ là English-only.

## Thay đổi trên nhánh — chưa merge/deploy

- Gửi rõ `speech_model: "universal-3-6-pro"` qua `assembly_ai_v3_streaming` khi tạo **bot mới**. Tên model và trường đã được kiểm tra trong schema Create Bot công khai của Recall; AssemblyAI công bố model này hỗ trợ tiếng Việt và tiếng Anh. Không gửi `language_codes` vì schema wrapper Recall chưa có trường đó. Giữ auto language detection, keyterms, stream riêng người nói, region và subscription hiện có.
- Không đổi min/max turn silence 400/1.600 ms khi chưa có phép đo âm thanh. Không hardcode mọi người nói thành tiếng Việt, không viết lại transcript gốc bằng LLM và không sửa tên bằng phỏng đoán.
- Nếu model bị từ chối, không bỏ `speech_model` để âm thầm quay về mặc định chưa rõ hỗ trợ Việt. Lần tạo phiên báo thất bại theo đường có sẵn. Fallback bỏ silence/keyword/language_detection cũ vẫn giữ model đã chọn. Log `requested_speech_model` là model đã **yêu cầu**, chưa phải bằng chứng model thực tế chạy hoặc chất lượng đã tốt lên.
- Dịch tối đa 4 câu nhìn trước. Writer lưu lần lượt phần đầu đã sẵn sàng; không chờ cả đoạn hoàn thành. Ví dụ câu 1 xong, câu 2 đang dịch thì câu 1 được insert ngay. Câu 2 vẫn phải chờ câu 1 để giữ thứ tự; không hứa xóa mọi trường hợp chờ.
- Không đổi prompt/ngữ cảnh/dedupe/quyền webhook/playback. Replay bỏ qua các câu đã lưu, bao gồm prefix đã lưu trước lỗi. Insert lỗi hoặc playback bật/không đọc được vẫn dừng ghi. Partial chỉ xóa sau insert thành công, không xóa partial mới hơn.
- Cửa sổ công việc luôn hữu hạn; dừng writer thì không tạo request mới. Các request đang chạy được chờ kết thúc và quan sát lỗi, tránh unhandled rejection và log hoàn tất sai thời điểm.
- Thứ tự writer ở đây là trong một webhook segment. Cơ chế `seq`/đồng thời giữa nhiều webhook không được thiết kế lại trong thay đổi này; phải kiểm tra chuyển đoạn/người nói trong nghiệm thu live.
- Thêm `first_insert_ms` vào log segment, `source_lang` + `translation_ms` vào log từng câu, tổng số lượt/thời gian dịch theo nhãn Việt/Anh vào log segment. Không log lời nói, key hay âm thanh. Không thêm query DB hoặc gọi AI chỉ để lấy số đo.

## Kiểm chứng local

- `bun install --frozen-lockfile`: pass, không đổi dependency.
- `deno check supabase/functions/angel-caption/index.ts`: pass.
- Bộ Deno `angel-caption`: **137 passed, 0 failed, 1 ignored**; bài ignored cần phiên thật. Kiểm tra prefix hiện sớm, hoàn thành ngược thứ tự, cửa sổ tối đa 4, replay, lỗi dịch, playback/insert lỗi, partial mới và log Việt/Anh không chứa lời nói.
- `bun test src`: **89 pass, 0 fail**; `bun run build`: pass (có cảnh báo chunk/annotation của dependency hiện có).
- Chưa gọi Recall/STT thật, chưa đo WER hoặc nghiệm thu live; không coi test mock là bằng chứng tốc độ/chất lượng thực tế đã tăng.

## Nghiệm thu trước merge/deploy

1. Review nhánh; xác minh tài khoản Recall ở region Tokyo chấp nhận model yêu cầu và chi phí áp dụng. Chưa tạo bot/gọi STT thật từ môi trường local; test mock không thay cho HTTP 201 của Recall.
2. Nếu được duyệt, merge rồi redeploy **function hiện có** `angel-caption`, không tạo function mới, không migration, không Publish frontend. Không dừng bot/phiên đang phát. Phiên cũ không tự nhận cấu hình model mới.
3. Tạo phiên kiểm thử mới bằng quy trình operator hiện có. Xác minh log yêu cầu model và cấu hình bot trên Recall; nếu bị từ chối, giữ thông báo lỗi, không bỏ model để ép chạy. Không coi log requested là kết quả xác minh runtime.
4. Đọc cùng 1–2 phút tiếng Việt và tiếng Anh, có tên người đã xác nhận, số, phủ định, ngập ngừng và chuyển người nói. Đối chiếu âm thanh với chữ trước khi đánh giá dịch; đo từ **cuối lời nói** đến partial, final, insert và xuất hiện trên trang. Báo WER/độ trễ thật, không dùng số đầu-câu ở trên như benchmark tương đương.
5. Với một đoạn nhiều câu, kiểm tra câu đầu xuất hiện trong khi câu sau còn dịch. Đọc log `first_insert_ms`, `translation_ms` theo ngôn ngữ và `last_insert_ms`; thử tail lỗi, replay, partial mới và playback để kiểm tra không đảo thứ tự/mất/trùng câu.

## Nguồn xác minh

- [Recall Create Bot](https://docs.recall.ai/reference/bot_create) — schema `assembly_ai_v3_streaming.speech_model`, xem bản Markdown của trang để đọc trường lồng nhau.
- [AssemblyAI model selection](https://www.assemblyai.com/docs/streaming/select-the-speech-model).
- [AssemblyAI Universal-3.6 Pro Realtime languages](https://www.assemblyai.com/blog/universal-3-6-pro-realtime-supported-languages).
- [AssemblyAI turn detection](https://www.assemblyai.com/docs/streaming/turn-detection) — giảm silence có thể tăng phân mảnh; không chỉnh trước khi đo.
