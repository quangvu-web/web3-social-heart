# Fixture OCR tổng hợp và quy trình benchmark

Chỉ có nội dung được tạo local cho phép dùng làm fixture: tiếng Việt có dấu, URL `.invalid`/handle giả, chữ nhỏ nhiều dòng và ảnh trống. Không có ảnh/screenshot Telegram thật. Tạo lại PNG trên macOS: `swift docs/operations/ocr-fixtures/generate.swift`. Golden text/dimensions trong manifest phải được đối chiếu lại; nếu font/OS đổi bytes thì cập nhật SHA256/bytes, không coi đó là output model.

## Hiện trạng

Chưa gửi ảnh đến Gemini/OpenAI. `evaluation.status=not_run`, CER/latency/actual usage để null. `cost-scenarios.json` là phép tính với giả định riêng, không phải invoice hay OCR score. Không dùng thời gian mock HTTP làm latency provider.

## Benchmark sau khi được phép

- Cùng PNG/SHA256, nguyên văn prompt OCR hiện tại, không history/persona/RAG; giữ request/version/model/detail ổn định. Khởi đầu một attempt, không cache, sau đó đánh giá retry/cache riêng.
- Output chỉ literal text, không greeting/translation/code fences. So sánh Unicode NFC; chuẩn hóa CRLF thành LF; không bỏ dấu tiếng Việt, không lowercase handle/URL hoặc sửa output trước chấm.
- Đo CER = Levenshtein edits / số Unicode codepoints của golden; thêm exact match dòng, URL, handle, ID và recall detector spam/FUN. Ảnh trống chấm hallucination (không chia CER cho 0). Không yêu cầu CER ≤1: insertion nhiều có thể lớn hơn 1.
- Đo latency monotonic từ bắt đầu HTTP đến response đầy đủ, kèm status/retry count, p50/p95 trên số lần đủ lớn do operator xác định. Không cần log full prompt hay ảnh để ghi metric.
- Thu billed input/output/reasoning/cached usage, tiền hoặc Run credits thực; tách attempt/run, provider lỗi, ảnh không chữ thành công. Không quy đổi credits→USD nếu không có định nghĩa/hóa đơn của account.
- Chỉ chọn model mới khi không làm giảm accuracy/recall/false-positive và đạt latency budget đã duyệt, với tổng chi phí thực thấp hơn. Bốn ảnh này chỉ smoke set; cần thêm fixture đã được phép về ảnh xoay/mờ, QR, chữ CJK, chữ nền phức tạp và mẫu benign/spam đã làm sạch trước quyết định moderation production.

## Probe current code (không gọi network thật)

```sh
deno test --config supabase/functions/deno.json --no-lock --allow-env --allow-read docs/operations/ocr-fixtures/current-ocr-probe.ts
```

Mock toàn bộ Telegram/Lovable fetch bằng các placeholder không phải credentials. Không cấp `--allow-net`. Probe xác nhận Gemini hardcode, data URL, same-instance cache, không gọi model khi thiếu key/media sai/quá lớn; và kiểm chứng error khác valid empty, concurrent cùng ảnh dùng một scan. Probe trước fix có 3 pass/2 fail; sau fix dùng hợp đồng typed và module OCR mới. Đây không phải test OpenAI hay chất lượng OCR thực.

Probe hiện chạy kèm typecheck. Integration webhook vẫn bị các lỗi typecheck legacy; xem [báo cáo follow-up](../telegram-ocr-cost-control.md) để phân biệt kết quả.
