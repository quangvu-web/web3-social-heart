# AI provider Giai đoạn 2 — đọc ảnh và OCR

Ngày 27/10/2026, Malaysia Time (UTC+8). Branch `feature/ai-provider-phase2`. Chủ dự án đã chọn **giữ chat ở Gateway trong đợt này** sau khi đối chiếu Bước 0. Nhánh FUN Core hiện có giữ nguyên.

## Phạm vi cuối cùng

`callAiGateway` cho phép Gemini direct khi cờ chọn `gemini`, không stream, và:

- `caption-translate` chỉ text, không có `image_url`.
- `describeImage` hoặc `ocr`, có thể mang ảnh.

Chat, tóm tắt, `transcribeAudio`, image generation và mọi label khác giữ đường hiện hành. `group-vision` giữ Gateway: probe payload phân loại cũ trả nội dung bị cắt, không đạt JSON; module này cũng không nằm trong bundle webhook hiện hành. Không nối lại moderation cũ hay tạo bài đăng giả để kiểm thử.

Sửa điều kiện eligibility, cho phép riêng OCR trả chuỗi rỗng hợp lệ và copy thẻ admin. Không đổi prompt, model, timeout/retry, `maxAttempts: 1` của vision, cache, OCR gate high-risk/tài khoản mới, FUN Core, transcript YouTube, schema, migration, auth hay secret. Shared helper cuối đã được deploy cùng `telegram-community-webhook`, **version 60 ACTIVE**; entrypoint webhook không có diff.

## Map cuối cùng

| Gateway id | Native id | Bằng chứng |
|---|---|---|
| `google/gemini-3.1-flash-lite` | `models/gemini-3.1-flash-lite` | Bước 0: ảnh thật, HTTP 200 với mô tả đúng và OCR `FUN / Profile / WEB3`; runtime helper OCR và DM ảnh thật đều ghi Gemini |

Không thêm model chat/registry hoặc `2.5-flash` vào map. Model override chưa map đi Gateway, log `unmapped_model`. Bằng chứng catalog/model trước thay đổi: [Bước 0](./ai-provider-phase2-step0.md), [JSON Bước 0](./ai-provider-phase2-step0-evidence.json).

## Nghiệm thu runtime

- **Cờ:** CAS từ `lovable` sang `gemini` lúc **23:45:13.821 MYT**, matched 1 row. CAS trả về `lovable` lúc **23:48:31.710 MYT**, matched 1 row; đọc lại xác nhận. Không đổi `enabled=true` hoặc các metadata khác. Cache production có thể giữ lựa chọn cũ tối đa 60 giây.
- **OCR helper thật:** probe runtime import và gọi đúng `runOcrOnPhoto`; key, helper, đọc flag và AI completion đều thật. Chỉ HTTP tải media Telegram được thay bằng PNG logo thật, không phải bài đăng hay luồng moderation giả. Kết quả `status=text`, `FUN\nProfile\nWEB3`; log `provider=gemini, label=ocr, model=models/gemini-3.1-flash-lite, attempt=1`, quan sát lúc **23:45:50.829 MYT**. Đây không phải test tải file qua Telegram thật.
- **DM ảnh thật:** gửi PNG logo bằng Telegram Web cho bot đã đối chiếu `getMe`, kèm caption “Angel đọc giúp bé những chữ trong ảnh này và mô tả màu sắc của logo nhé.” Webhook nhận message **7649**. Log **23:46:34 MYT**: `[ai-gateway] ai_call`, `provider=gemini`, `label=describeImage`, `model=models/gemini-3.1-flash-lite`, `attempt=1`. Log **23:46:36 MYT**: `reason=model_success`. Bot trả lời lúc **23:46:51 MYT**, nêu đúng FUN / Profile / WEB3, chữ FUN và WEB3 trắng, Profile vàng, nền xanh lá lấp lánh. Đã xem ảnh và câu trả lời trên UI. Usage event **160297** ghi một attempt Gemini; metadata này chỉ theo dõi helper, không tính request FUN Core.
- **Chat sau mô tả ảnh:** log `callFunCore` / `reply provider=funcore` cho câu trả lời cuối; giữ nguyên đường chat theo quyết định chủ dự án. Không tuyên bố chat đã đi Gemini. Không gửi thêm câu chat/YouTube vào nhóm vì phạm vi đó đã được loại khỏi đợt này.
- **Fallback ảnh 429:** probe gọi helper với ảnh và `maxAttempts=1`; chỉ HTTP direct được mock 429. Log một attempt Gemini → `provider_fallback`, reason `direct_failed`, status 429 → một attempt Gateway thật, HTTP 200. Body/model Gateway gốc giữ nguyên theo regression test. Không sửa key hay tạo lỗi production để thử.
- **Model chưa map:** probe dùng model Gateway `google/gemini-2.5-flash`, label `describeImage`, ảnh thật. Log `unmapped_model` rồi một attempt Gateway thật, HTTP 200, không gửi direct.

Probe runtime có bearer ngẫu nhiên, backend chỉ giữ SHA-256, hạn một giờ; không có API ghi DB ngoài CAS đúng row `ai.provider`. Sau thử đã xóa probe khỏi backend và source/bearer local. Không giữ probe, secret hay token trong git. Không chạy migration.

Bằng chứng runtime đã bỏ credential và chuẩn hóa thời gian MYT: [ai-provider-phase2-runtime-evidence.json](./ai-provider-phase2-runtime-evidence.json).

## UI

Thẻ đổi thành **Nhà cung cấp AI**, công tắc **Dùng key Gemini riêng**. Scope ghi dịch phụ đề, đọc ảnh và OCR; ghi rõ công tắc chưa áp dụng cho chat, câu trả lời YouTube và tóm tắt. Giữ TTL ~60 giây, cảnh báo các call direct không hiện trong AI activity Lovable, fallback từng call, `meta.value` là nguồn trạng thái, dòng `ai.provider` ẩn khỏi danh sách cờ chung.

Smoke render component thật bằng React test renderer, thay biên DB bằng fixture: copy/scope đúng; danh sách chung chỉ có cờ khác; bật công tắc ghi `meta.value=gemini`, đọc riêng sau upsert; remount đọc lại cả `gemini` và `lovable` đúng. Đây là kiểm tra component với DB fixture, **không phải** reload trang admin production với DB thật. Đã mở preview local `/admin?tab=feature-flags`, app chuyển tới onboarding `/law-of-light`; không chấp thuận điều khoản hoặc bỏ guard để ép mở trang. Frontend chưa được merge/publish; cần kiểm tra hosted preview trước merge main.

## Kiểm thử

- **Frontend:** `bun test src` — **59 pass, 0 fail**. `bun run build` — exit 0; có cảnh báo Browserslist/baseline data cũ, PURE annotation và bundle size, không đổi dependency để xử lý ngoài phạm vi. File version tự sinh được restore.
- **Edge provider:** `deno test --allow-env --allow-net supabase/functions/_shared/ai-provider_test.ts` — **23 pass, 0 fail**. Trước sửa, ba regression mới fail đúng vì ảnh chưa direct/fallback/audit; sau sửa pass. Test xác nhận 429 không đổi provider cho call sau, stream/label ngoài phạm vi/model chưa map vẫn an toàn.
- **Edge vision/OCR:** `deno test --no-lock --node-modules-dir=none --no-check --allow-env --allow-net --allow-read` với `telegram-ocr.test.ts`, `telegram-ocr-moderation.test.ts`, `telegram-vision_test.ts`, `telegram-vision-transport_test.ts` — **20 pass, 0 fail**. Có cảnh báo punycode. Không gọi typed suite pass. Lần chạy đầu bị lỗi resolution `typescript`; dùng global Deno cache và bỏ lock cho lệnh test để tránh lockfile chứa registry proxy khác origin. Không sửa lockfile hoặc dependency.
- **Typecheck shared helper:** `deno check supabase/functions/_shared/ai-gateway-retry.ts` — pass.
- **Toàn repo dưới Bun:** bare `bun test` — **62 pass, 70 fail, 70 errors**. Các lỗi là Bun không resolve Deno `npm:`/URL imports hoặc globals; không gọi toàn repo pass. Cùng loại/count đã ghi trong nghiệm thu Giai đoạn 1.
- Diff chỉ gồm helper, provider tests, copy admin và tài liệu. Không thay adapter chat, OCR/vision implementation, cache, config, schema hay file được bảo vệ.

Review độc lập phát hiện validator Gemini cũ buộc mọi response khác rỗng, trái hợp đồng OCR cho ảnh không có chữ. Đã tái hiện test RED với Gemini trả chuỗi rỗng / Gateway 503, rồi sửa riêng label OCR để giữ thành công này, không tốn một fallback. Có test cho missing/null/object vẫn fallback và empty caption/describe vẫn fallback; suite cuối 23 pass. Reviewer xem lại không còn finding. Các probe runtime ảnh có chữ chạy trước sửa validator này; thay đổi cuối được xác minh bằng regression test và deploy lại webhook khi cờ đã về lovable.

## Giới hạn nghiệm thu

Chưa kiểm tra hosted UI sau reload/ghi DB thật, chưa test ảnh ở nhóm trong đợt này, chưa quan sát một call mới sau cache rollback hết hạn. Không dùng probe hoặc test fixture thay cho các bằng chứng đó. Chat/YouTube direct và classifier `group-vision` không nằm trong phạm vi triển khai đã điều chỉnh.
