# FUN Profile: kiểm kê AI và đánh giá OCR

> Snapshot audit trước sửa. Phần triển khai hai lỗi OCR theo yêu cầu tiếp theo nằm trong [báo cáo OCR cost control](telegram-ocr-cost-control.md); các kết quả đỏ bên dưới là bằng chứng trước fix.

Ngày kiểm kê: **07/10/2026, Malaysia Time (UTC+8)**. Phạm vi: mã local, tài liệu nhà cung cấp, fixture tổng hợp và mock transport. **Chưa thay provider, chưa tiết kiệm chi phí production.**

## Quyết định

**Giữ OCR Gemini hiện tại trong runtime. Chưa triển khai adapter OpenAI.** Chưa có số đo chất lượng/latency hai model trên cùng ảnh và chưa lấy được breakdown billing của project. Điều kiện người dùng yêu cầu “OpenAI phù hợp hơn về chi phí và chất lượng” chưa đạt. Giá token thấp hơn chỉ là tín hiệu để benchmark, không phải bằng chứng đủ để chuyển.

Diff này chỉ thêm báo cáo, fixture, kịch bản chi phí và probe chẩn đoán. Không sửa hội thoại FUN Core, webhook, moderation, CAPTCHA, welcome, schema, RLS, secrets hay cấu hình production. File có sẵn `supabase/migrations.zip` được giữ nguyên.

## Dashboard và giới hạn bằng chứng

Số liệu do người dùng cung cấp: 678 AI requests, 2,21 credits/30 ngày; các dòng đang hiển thị có title `Extract all readable text from this image.`, model `google/gemini-3.1-flash-lite`, khoảng 0,0026 credits/lượt.

- Title và model khớp chính xác `runOcrOnPhoto` trong `supabase/functions/_shared/telegram-community.ts:5711–5748`. Đây là bằng chứng code về nguồn có thể tạo các dòng OCR được mô tả; chưa đối chiếu request ID của dashboard với Edge logs.
- Bình quân tổng là `2,21 / 678 = 0,003259587` credits/request. Nếu giả định tất cả đều đúng 0,0026 thì tổng chỉ `678 × 0,0026 = 1,7628` credits. Không suy luận 0,4472 credits còn lại là tác vụ nào: có thể khác token/output, retry, rounding, model hoặc khoảng tổng hợp. Không quy toàn bộ 678 request cho OCR.
- Connector đọc project ID trong README trả **project not found**. Có nhiều project/remix tên gần giống; không truy vấn DB của project khác để đoán. Không thể kết luận thiếu quyền hay project đã chuyển chỉ từ lỗi này. Chưa có export usage production.
- [Lovable AI dashboard](https://docs.lovable.dev/features/ai) có metadata model, token, cost, duration và group theo run; người vận hành có thể xuất/đối chiếu **chỉ metadata**, không mở nội dung request/response. Cần cùng project và cùng cửa sổ 30 ngày, bao gồm mọi trạng thái/step/retry. Không cần bật lưu full prompt để làm breakdown.

## Đường OCR moderation hiện tại

`Telegram update → group settings / anti-spam guards → caption/text/preview/bot/keyword rules → OCR nếu chưa có reason → detector trên OCR → các heuristic còn lại → moderation action`.

Điều kiện ở `telegram-community-webhook/index.ts:2363`: `!reason`, `enable_ocr_scan !== false`, và `(isHighRiskContainer || isNewUser)`; phải chọn được photo/document ảnh/thumbnail. High-risk gồm forward, external reply/preview, checklist/poll container. Người mới được tính từ `joined_at` và `new_user_restriction_hours`. Content FUN/tâm linh tin cậy có bypass riêng trước OCR và khi kết hợp OCR; không thay ngoại lệ này.

OCR dùng `LOVABLE_API_KEY`, model hardcode và helper `callAiGateway`. `ANGEL_MODEL_VISION` **không** đổi model OCR moderation. Media tải server-side qua bot token rồi gửi data URL, không gửi Telegram download URL chứa token cho AI.

| Thành phần | Hiện trạng / giới hạn |
|---|---|
| Cache OCR | Map theo `file_unique_id`/fallback identity, TTL 6 giờ; chỉ cùng instance. Không có in-flight claim, giới hạn entry hay cơ chế prune entry hết hạn. |
| Retry AI | `ai-gateway-retry.ts`: tối đa 3 attempt, timeout 60s/attempt; retry 408/429/5xx/network. 400/401/402/403 không retry. Retry là thêm attempt, không thể coi một tin nhắn là một request tính phí. |
| Media | `telegram-media.ts`: tối đa 10 MiB cho OCR, timeout 30s/request, mỗi getFile/download tối đa 3 attempt. Kiểm tra size trước và sau tải; đọc toàn bộ body trước kiểm tra sau tải. |
| MIME | OCR chỉ kiểm tra prefix `image/`; helper có `isGeminiSupportedImageMime` nhưng OCR không gọi. BMP/SVG/HEIC có thể đi xa hơn validation mong muốn. Future OpenAI phải allowlist đúng PNG/JPEG/WEBP/GIF không động. |
| Response | Gateway xác minh `choices` là array, chưa buộc có text choice hợp lệ. OCR trả string, lỗi/missing key/media lỗi đều `""`. `choices: []` cũng có thể trở thành empty text và được cache. |
| Logging/usage | Không ghi token/credit/status OCR theo từng attempt vào billing ledger. Gateway log error body tối đa 400 ký tự; provider có thể echo dữ liệu nhạy cảm. Không thêm log full prompt/base64 trong diff này. |
| Moderation khi lỗi | Caller `if (ocrText)` không phân biệt OCR unavailable với ảnh không chữ; các detector text/heuristic khác vẫn tiếp tục. Không tuyên bố ảnh đã scan thành công. Đây là giới hạn cần sửa riêng trước triển khai adapter. |

## Kiểm kê tác vụ AI

Mọi model dưới đây là **giá trị runtime mặc định trong code**, không phải xác nhận cấu hình/live traffic production. Calls qua Lovable dùng `LOVABLE_API_KEY` và có thể phát sinh Lovable Run credits. FUN Core/Google direct/fal có quota/hóa đơn riêng; không có dữ liệu để định giá quota FUN Core hoặc xác nhận phí tài khoản.

| Tác vụ và nguồn | Provider/model mặc định | Trigger / điều kiện | Retry, cache, usage / tác động nếu tắt |
|---|---|---|---|
| Hội thoại web/inline/Telegram (`angel-core.ts:118`, `angel-chat:146`, `angel-inline:108`, `telegram-community:2937`) | FUN Core khóa cứng; upstream model không được repo xác định | User gửi, inline @Angel, DM, group triggers, event/meditation AI; `ANGEL_AI_PROVIDER` không đổi primary | FUN Core timeout 25s, retry một lần lỗi network/5xx, breaker 5 lỗi/30s; histories và response cache. Giữ primary. |
| Fallback hội thoại (`telegram-community:2994,3199,3426`) | Lovable `google/gemini-3-flash-preview` | Empty reply, anti-repeat/error recovery; creative regeneration chỉ khi `router.regen_creative_offramp` bật, mặc định false | Chỉ nhánh empty-reply đọc `cost.lovable_retry_enabled`; hai nhánh khác không đọc flag này. Tắt flag chưa bảo đảm không có Lovable call. Tắt recovery sẽ giảm khả năng đáp khi FUN Core lỗi; không chuyển primary. |
| Restyle/repair ngôn ngữ (`telegram-community:2166,2189`) | FUN Core | Explicit `aiStylePrompt` hoặc language mismatch; bỏ short DM/factual concrete/verbatim khi phù hợp | Restyle DB cache 7 ngày. Có cost/quota upstream riêng, không trực tiếp Lovable. |
| Style pass (`angel-postprocess.ts:810`, `angel/models.ts:56`) | Lovable `google/gemini-3.1-flash-lite`; `ANGEL_MODEL_STYLE_PASS` | `cost.postprocess_enabled`, `postprocess.style_pass` và rule config; rule mặc định disabled; thresholds 700 chars, bỏ long/code/table/structured reply | Một fetch, không explicit timeout/cache. Tắt giữ nội dung primary, mất shortening/emoji pass. Narrative repair cùng model có đường riêng nhưng Telegram addressing hiện dùng deterministic guard. |
| Memory (`angel-memory.ts:13,170,206`) | Lovable hardcode `google/gemini-3.1-flash-lite` | `cost.memory_extract_enabled`; channel web/DM mặc định bật, group/inline tắt; mỗi 5 turns | `angel_user_memory`; không retry/timeout rõ. Tắt giảm personalization dài hạn; không cần tắt conversation. `ANGEL_MODEL_MEMORY_EXTRACT` registry không điều khiển leaf này. |
| Summary (`angel-rolling-summary.ts:12,90,130`) | Lovable hardcode `google/gemini-3.1-flash-lite` | `cost.rolling_summary_enabled`; channel setting mặc định disabled, threshold 12/keep 8 | `angel_conversation_summary`; không novelty/version guard trước fetch nên có thể làm lại các turn sau threshold. Tắt giảm long-term continuity. |
| OCR moderation (`telegram-community.ts:5711`) | Lovable hardcode `google/gemini-3.1-flash-lite` | Group `enable_ocr_scan` và risk/new-user guards | Cache 6h isolate, gateway max 3. Tắt mất khả năng đọc spam trong ảnh; không khuyến nghị tắt chung. |
| Mô tả ảnh legacy (`telegram-community.ts:5631,5665`) | Lovable `ANGEL_MODEL_VISION` hoặc Flash Lite 3.1 | `cost.vision_describe_enabled` | Cache isolate 30m, gateway max 3; **không tìm thấy active caller** sau khi webhook bỏ local describe. Không giả định tắt tiết kiệm traffic đang chạy. |
| Voice/audio/video-note DM (`telegram-community.ts:5804,5826`, webhook:1166) | Lovable `ANGEL_MODEL_VISION` hoặc Flash Lite 3.1 | `cost.voice_transcribe_enabled`, có voice/audio/video note | Cache isolate 30m, 20 MiB, gateway max 3. Tắt mất voice input. |
| Avatar join guard (`telegram-join-guard.ts:103,150`) | Lovable `ANGEL_MODEL_VISION` hoặc Flash Lite 3.1 | Join/name/avatar guard và `cost.join_avatar_scan_enabled` | Persistent `telegram_join_avatar_scans` cache verdict theo file identity, media 5 MiB. Tắt giảm kiểm tra avatar; không đổi rule trong audit. |
| Image/PDF knowledge ingest (`angel-files-ingest.ts:111,160`) | Lovable `google/gemini-3-flash-preview` | File trong watched channels; ảnh/PDF | Gateway max 3, 20 MiB, knowledge rows `angel_channel_knowledge`. DOCX/XLSX/plain text parse local, Google Sheets export không phải model call. Tắt AI extraction làm thiếu knowledge từ ảnh/PDF. |
| Legacy text moderation (`telegramGroup.ts:287`) | FUN Core; model argument Gemini 2.5 Flash Lite không được forward | Legacy moderation eligibility | Không quy cho Gemini chỉ vì có argument model. Multimodal classifier Flash 2.5 qua Lovable là dormant (`void aiClassifyMultimodal`). |
| Weekly loss-cause report (`telegram-community-weekly-report:22,141`) | Lovable `google/gemini-2.5-flash` | Weekly report cho group đủ điều kiện | Không explicit cache/timeout/cost flag; lỗi bỏ phần AI analysis. Daily report không có model call. Tắt chỉ mất giải thích AI, vẫn có thống kê. |
| Admin debug (`angel-debug:78`) | FUN Core hoặc Lovable `google/gemini-2.5-flash` theo lựa chọn | Admin verified chạy prompt | Có thể tính phí thật. Không chạy trong audit. |
| Image prompt distill (`angel/image-distill.ts:94`) | Lovable `google/gemini-3.6-flash` | `image.distill_enabled` mặc định true; prompt ≥180 hoặc analytical; trước image tiers | Timeout 3s, deterministic fallback, không cache prompt. Telemetry có thể ghi success cho deterministic fallback. Tắt có thể giảm độ tập trung prompt. |
| Heavy image prompt rewrite (`angel-image.ts:880`) | Lovable Flash Lite 3.1; `ANGEL_MODEL_PROMPT_REWRITE` | `image.rewrite_prompt`, heavy prompts | Timeout, một fetch. Dù ảnh cuối do FUN Core tạo, bước rewrite vẫn có thể tính Lovable. Tắt ảnh hưởng bố cục/nội dung heavy prompts. |
| Image P1/P2 (`angel-image.ts:502,590`) | FUN Core generate-image, fast/spiritual; upstream model chưa biết | Yêu cầu vẽ; root mode/flags | Spiritual có thể retry fast, telemetry `angel_image_pipeline_logs`. HD/design có thể bypass root. Provider cost/quota riêng. |
| Chỉnh ảnh (`angel-image.ts:918–938`) | FUN Core `/edit-image`; upstream model chưa biết | Yêu cầu sửa ảnh có URL/base64 và instruction | Leaf riêng gọi `postJson`, không qua distill/generation P1–P5 và không có Lovable fallback tại leaf. Quota/chi phí FUN Core chưa xác minh. |
| Image P3 (`angel-image-fallback.ts:128`, models:74/80) | Lovable `google/gemini-3.1-flash-image` hoặc `google/gemini-3-pro-image`; env `ANGEL_MODEL_IMAGE_FAST/HEAVY` | Root lỗi hoặc heavy/design/HD; `image.fallback_lovable_enabled`/env flag | Default 5/user/Malaysia day, table `angel_lovable_image_fallback_usage`; timeout 30/60s. `forceProOnHeavy` có thể bypass disabled fallback flag. Counter read/update không atomic; DB lỗi có thể fail open. Tắt bỏ tier fallback này. |
| Image P4 direct (`angel-image-gemini-direct.ts:11,35,40`) | Google `gemini-2.5-flash-image` rồi `gemini-3.1-flash-image` | Tier trước fail, có `GEMINI_API_KEY`; model/fallback env | Tối đa hai model trên lỗi retryable, **Google billing riêng**; không tìm thấy daily quota local. Metadata stage `lovable` có thể gây hiểu nhầm. |
| Image P5 (`angel-image-fal.ts:25,63,103`) | fal `flux/schnell`, logo `ideogram/v2`, heavy `flux-pro/v1.1`; env overrides | `image.fal_enabled`/`ANGEL_FAL_ENABLED`, có `FAL_API_KEY` | Default 5/user/day qua `angel_fal_image_usage`, **fal billing riêng**. Tắt mất tier fallback cuối. |
| Meditation broadcast (`meditation-broadcast:89,374`) | Lovable `google/gemini-2.5-flash-image` | Admin gửi, không có ảnh đã cấu hình; cron bị disabled | Một ảnh dùng chung recipients. Generate **trước** check idempotency từng chat; repeat có thể vẫn tốn dù skip hết recipients. Dùng ảnh admin tránh generation. |
| Optimize storage (`optimize-storage:139,234`) | Lovable `google/gemini-2.5-flash-image-preview` | Admin tối ưu eligible image, default limit 50 | Generative call **trước** `dryRun` upload guard: dry run vẫn có thể tính phí. Đề xuất compression deterministic riêng; tắt không ảnh hưởng lưu trữ hiện tại. |

Registry `chat_primary`, `chat_backup`, `memory_extract` trong `angel/models.ts` không có active `MODELS` consumer được tìm thấy. Không dùng tên model trong registry làm bằng chứng model thực chạy. Chat/inline GET history, DELETE history, quota-status, channel management, knowledge push không tự chứng minh một LLM generation; chi phí upstream knowledge embedding/ingest chưa biết.

### Secret/config đọc ở server (chỉ tên)

`LOVABLE_API_KEY`; FUN Core `ANGEL_AI_API_KEY`, `ANGEL_AI_CHAT_BEARER`; image precedence `ANGEL_AI_API_KEY_IMAGE` → `ANGEL_ROOT_API_KEY_IMAGE` → `ANGEL_ROOT_API_KEY` → `ANGEL_AI_API_KEY`; direct `GEMINI_API_KEY`, `FAL_API_KEY`; media `COMMUNITY_GUARD_BOT_TOKEN`/legacy `TELEGRAM_BOT_TOKEN`; infrastructure `SUPABASE_SERVICE_ROLE_KEY`. URL/model/flag env là config, không phải credential. Không đọc giá trị secrets/.env và không xác nhận secrets nào tồn tại production.

## Usage local chưa phải billing ledger

- `telegram_ai_runtime_logs` có trường model/cost, nhưng success caller webhook:5031 không truyền model hoặc `estimatedCost`. Tokens `ceil(chars/4)` chỉ question/final reply, thiếu history/system/RAG/vision/retry; provider `getAngelProvider()` có thể khác provider recovery thực tế. Còn có cache/blocked/deterministic rows.
- `admin-cloud-usage:73,123–127` đếm rows và đổi null cost thành 0; bỏ qua error query AI. `$0` tại UI không chứng minh zero spend. Capped 50.000 rows; Telegram panel đọc 1.000 rows/24h và nhãn “Gemini calls” đếm cả provider khác.
- `angel_ai_events`: các pipeline wrapper trackAi không có active consumer; active `knowledge.push` không truyền tokens/credits/model. Admin AI Ops đọc 2.000 rows, không đủ billing breakdown.
- `angel_image_pipeline_logs` có tier/model/duration/status nhưng không billed tokens/cost/shared run ID; panel cap 500 rows. `telegram_ai_conversations` lưu history/provider/latency/error, không cost/model usage đầy đủ.
- `cloud_usage_events` là thời lượng handler/status, không phải token cost hoặc CPU billable. Cần ghi provider/model/task/run/attempt/status và **usage thực trả về**, không lưu full prompt/ảnh. Tách `unknown` với zero, và lỗi query với empty data. Đề xuất riêng; chưa sửa UI/schema.

## So sánh OpenAI: giá hiện hành, chưa có thắng benchmark

[GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) nhận ảnh và trả text; Standard short-context $0,10 input / $0,50 output mỗi triệu token. [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) cũng nhận ảnh; $0,20 / $1,20. GPT-5.4 nano đã có nhãn deprecated trên trang model, không lấy làm mặc định mới. Không thay runtime bằng model nào trong audit này.

[OpenAI vision](https://developers.openai.com/api/docs/guides/images-vision) hỗ trợ PNG/JPEG/WEBP/GIF không động; tài liệu hiện tại cho phép payload tổng 512 MB/1.500 ảnh, nhưng adapter tương lai vẫn nên giữ giới hạn OCR repo 10 MiB/một ảnh. OCR nên benchmark `original` khi model hỗ trợ, vì `low` không bảo đảm rẻ hơn hay đọc chữ nhỏ tốt. Image/prompt/output đều tính phí; token reasoning cũng phải được tính.

Google công bố [Gemini 3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/pricing) paid Standard $0,25 input text/image/video, $1,50 output mỗi triệu token. **Đây là Google direct rate**, chưa phải quy đổi Lovable Run credits hay giá của account/project. [Lovable billing](https://docs.lovable.dev/features/ai) là ledger credits khác; chưa xác minh đơn vị/quy đổi trong dashboard được mô tả.

Công thức cùng một ảnh i:

`USD_OpenAI(i) = (image_tokens_O(i) + prompt_tokens_O(i)) × input_rate / 1e6 + billed_output_tokens_O(i) × output_rate / 1e6`

`USD_Gemini_direct(i) = billed_input_tokens_G(i) × 0,25 / 1e6 + billed_output_tokens_G(i) × 1,50 / 1e6`

Phải dùng token riêng của từng model, cộng mọi attempt, cache-write/residency/tier/tax nếu áp dụng. Không đồng nhất token ảnh giữa hai model. Với giả định **cùng 1.000 input + 200 output tokens**, Luna 6 $0,000200; Luna 5.6 $0,000440; Gemini direct $0,000550. Đây là so sánh rate, **không phải measured same-image cost hoặc quyết định chuyển**.

### Fixture và kịch bản offline

Bốn PNG do code local tạo, đã kiểm tra hiển thị; `manifest.json` có golden text, kích thước, SHA256, bytes và mọi quality/latency/billing field đều `not_run`/null. Không có ảnh người dùng, dữ liệu Telegram, URL thật hay PII. Generator AppKit không gọi API.

Bảng sau chỉ là kịch bản Luna 5.6 `original` (family này có patch rules được tài liệu mô tả): image tokens = `ceil(ceil(w/32) × ceil(h/32) × 1,2)`. Các fixture nằm dưới giới hạn 30.000 patches và 65.535px mỗi chiều của chế độ này, không resize. Giả định 100 prompt tokens, output dưới đây, không caching/reasoning/retry/tax. Không dùng công thức này để đoán Luna 6; bảng vision đã đọc chưa liệt kê sizing của Luna 6.

| Fixture | Pixel | Image tokens giả định | Output tokens giả định | USD kịch bản | Gemini/OpenAI accuracy, latency thật |
|---|---:|---:|---:|---:|---|
| vietnamese | 1024×512 | 615 | 200 | 0,0003830 | Chưa đo cả hai |
| synthetic-links | 1024×768 | 922 | 200 | 0,0004444 | Chưa đo cả hai |
| dense-small | 1024×1024 | 1.229 | 1.000 | 0,0014658 | Chưa đo cả hai |
| no-text | 512×512 | 308 | 50 | 0,0001416 | Chưa đo cả hai |

Luna 5.6 ở bảng là model tham chiếu có quy tắc ảnh đã xác minh, **không là mặc định adapter mới**. Giá thấp không chứng minh CER, tiếng Việt/handle/URL hay latency tốt hơn. Chi phí Gemini qua Lovable trên đúng bốn ảnh chưa đo, không gán 0,0026 credits từ ảnh khác vào đây.

## Ưu tiên tiết kiệm, tách thành các thay đổi riêng

1. Đo metadata thật theo task/provider/model/attempt và sửa hiển thị unknown/error; không thêm raw prompt vào logs.
2. Ngăn duplicate trước paid call: broadcast idempotency trước generate; OCR in-flight coalescing; nghiên cứu durable OCR claim/cache. Persistent OCR cache cần thiết kế schema riêng, RLS/GRANT/service-only/retention và người vận hành duyệt. Không tái dùng bảng avatar verdict cho text OCR vì khác key/lifetime/semantics. Không dùng Map làm bảo đảm cross-instance.
3. Sửa OCR contract thành `success{text}` hoặc `unavailable{reason}`; empty success chỉ khi response hợp lệ và thật sự không chữ. Model/size/MIME validation, max-output bound, deadline, bounded retry và safe metadata logging. Giữ nguyên detectors/guards khi unavailable.
4. Sửa dry-run storage không gọi AI; dùng compression deterministic cho giảm dung lượng. Ưu tiên ảnh meditation admin đã có thay vì generate.
5. Khép Lovable kill-switch gaps của recovery/image heavy; nâng novelty guard summary; chỉ tắt optional memory/style/voice theo nhu cầu đã xác nhận. Không tắt OCR/avatar chung để “tiết kiệm”, không đổi FUN Core primary.
6. Chỉ sau measured benchmark mới xem xét riêng OpenAI OCR. Schema-free local coalescing chỉ là bổ trợ, không giải quyết cold-start/cross-instance.

## Điều kiện adapter OpenAI tương lai (chưa triển khai)

Secret server: `OPENAI_API_KEY`. Config đề xuất: `ANGEL_OCR_PROVIDER=gemini|openai`, `ANGEL_OCR_MODEL=<model thắng benchmark đã xác minh còn hỗ trợ ảnh>`. Hiện code **không đọc các tên này**; đặt chúng bây giờ không bật OpenAI. Không có secret/config mới cần đặt cho diff này.

Nếu adapter được duyệt sau: người vận hành đặt key trong **Secrets của backend Supabase đang triển khai Edge Functions**, không frontend/.env, không dán key vào chat. Giữ `enable_ocr_scan` theo nhóm. Khi chọn OpenAI, thiếu key/timeout/API lỗi/invalid response phải báo unavailable; **không fallback Lovable**, không trả empty success. Không gửi Telegram URL chứa token. Cache key phải gồm file identity/provider/model/prompt-version, bounded retention; không cache lỗi như OCR sạch.

Test bắt buộc trước bật adapter: đúng provider/model; key thiếu; 400/401/403/429/5xx/network/timeout; response lỗi/choices rỗng hoặc không text; MIME magic bytes/animated GIF/10MiB; cache hit/expiry/model separation/concurrency; valid empty; OpenAI lỗi không tạo Lovable fetch; cờ group/risk guards và detector FUN/spam không đổi. Chưa có adapter OpenAI nên **chưa chạy được tests đường OpenAI**, không dùng mock output làm bằng chứng accuracy/latency.

## Kiểm thử và bàn giao

Probe chẩn đoán có hai assertion đỏ cố ý giữ để người review tái hiện contract gap và duplicate; nó nằm trong docs, không được auto-discover bởi Edge suite. Không gọi chúng là fix pass. Runtimes/providers/moderation chưa được thay đổi vì gate chất lượng/chi phí chưa đạt.

Lệnh đã chạy local:

- `bun test src`: **40 pass, 0 fail**, 11 files, 91 assertions. Đây là frontend suite, không phải Edge suite hay frontend typecheck.
- `deno test --config supabase/functions/deno.json --no-lock --allow-env --allow-read docs/operations/ocr-fixtures/current-ocr-probe.ts`: **typecheck thất bại**, tests chưa chạy. Ba TS2345: `router.strict_mirror` tại `angel-core.ts:484`, `group.per_user_history` và `factual.include_user_context` tại `telegram-community.ts:2583,2588` không thuộc `FlagKey`. Các source này không khác `main` local; không sửa lỗi ngoài phạm vi audit.
- Cùng probe thêm `--no-check`: **3 pass, 2 fail**. Assertion đỏ: unavailable và valid empty cùng `""`; concurrent cùng ảnh gọi gateway hai lần. Đây là kiểm chứng runtime bằng mock, không phải typecheck pass, OCR accuracy hay latency provider.
- Deno ba files `telegram-community.spam.test.ts`, `telegram-scam-protection.test.ts`, `telegram-join-guard.test.ts` với cùng config/permissions: typecheck bị chặn bởi ba lỗi trên. Chạy riêng assertions với `--no-check`: **46 pass, 1 fail** (`mention_bait: 2 foreign bots with only emoji/punct → detected`, actual false/expected true). Source/test liên quan giữ nguyên so với `main` local; lỗi hiện có chưa sửa. Không gọi toàn bộ Edge suite là pass.
- `swiftc -typecheck docs/operations/ocr-fixtures/generate.swift`: **pass**. Bốn PNG đã xem bằng image viewer; script local xác nhận SHA256/bytes/dimensions khớp manifest và bốn phép tính chi phí khớp JSON.
- `git diff --check`: **pass**. Vì các artifact mới còn untracked, kiểm tra riêng newline/trailing whitespace và rà nội dung toàn bộ file mới; không có giá trị secret, ảnh riêng tư hay dữ liệu Telegram thật.

Không chạy API AI tính phí, không gọi Telegram production, không sửa dữ liệu/secret/config production; không migration, commit, push, merge hoặc deploy. Branch `feature/ai-cost-ocr-audit`, archive có sẵn giữ nguyên. Diff chỉ gồm tài liệu và fixture/probe offline. Chưa có adapter nên test lựa chọn OpenAI/timeout/no-Lovable-fallback chưa thể chạy; ma trận bắt buộc đã ghi cho thay đổi tương lai.
