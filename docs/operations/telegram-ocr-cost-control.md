# OCR: kết quả rõ ràng và single-flight theo instance

07/10/2026, Malaysia Time (UTC+8). Target do người dùng chỉ định: Lovable **Remix of FUNPROFILE CỦA BÉ VŨ**, project ID `7493b9b9-163e-44ad-a619-bffe188dcc45`. Branch local `feature/ai-cost-ocr-audit`. Không xác minh deployment/usage live của project trong lần sửa này.

Dashboard mới do người dùng cung cấp: 701 requests, 2,30 credits/30 ngày. Các dòng hiển thị có prompt/model trùng đường OCR trong code. Bình quân tổng `2,30 / 701 ≈ 0,003281027` credits/request; không quy mọi request cho OCR, không quy credits ra USD khi chưa có breakdown/hóa đơn. Audit trước là snapshot trước sửa; xem [kiểm kê đầy đủ](ai-cost-ocr-audit.md).

## Bằng chứng và thay đổi

Mười regression tests được viết trước production code và chạy trên code cũ: **0 pass, 10 assertion fail**. Hợp đồng string không phân biệt lỗi và valid empty; Map chỉ có completed cache nên concurrent misses đều gọi gateway. Không có bằng chứng đây là nguyên nhân của toàn bộ billing production.

- `_shared/telegram-ocr.ts`: helper OCR tách riêng, cùng Gemini/prompt/media limit/retry hiện có. Kết quả phân biệt `text{text}`, `empty{text:""}`, `unavailable{reason,httpStatus?}`. Không có `text` trên unavailable. Missing config/media, HTTP/network và malformed responses không trở thành empty success.
- `_shared/telegram-community.ts`: giữ export `runOcrOnPhoto` bằng re-export; bỏ implementation/cache string cũ. Chỉ có một moderation call site runtime, đã cập nhật.
- `telegram-community-webhook/index.ts`: chỉ trạng thái text đưa vào OCR detectors. Unavailable ghi reason/status với chat/message ID và tiếp tục các luật text/URL/rate hiện có, không tự tạo violation/clearance. “Kept” của pipeline nghĩa là không action, không chứng nhận ảnh đã OCR sạch. CAPTCHA/welcome/AI trigger/FUN exceptions không đổi.
- `_shared/ai-gateway-retry.ts`: thêm option tắt upstream body/error details trong logs; OCR dùng option này. Caller khác giữ logging/retry hiện có. OCR logs chỉ provider/model/status/reason/HTTP status/latency, không text/base64/file ID/raw exception/URL/token.
- Success cache TTL **6 giờ từ khi hoàn tất**, gồm valid empty; unavailable không cache. Promise in-flight theo `file_unique_id`, fallback file ID với namespace riêng; dọn trong `finally`, retry sau lỗi được phép. Không share giữa ảnh khác.

**Giới hạn:** cache/single-flight chỉ cùng Edge Function instance. Không dedupe xuyên instance/cold start; retry gateway tối đa ba attempt vẫn có thể phát sinh nhiều requests. Chưa thêm cache schema, budget/quota, telemetry billing hay sửa các tác vụ khác. Không hứa số credits tiết kiệm thực tế.

## Kiểm thử local

Không cấp `--allow-net`; mọi HTTP trong tests OCR/webhook được mock với dữ liệu tổng hợp. Không gọi Telegram/Lovable/OpenAI production.

- Focus có typecheck: `deno test --config supabase/functions/deno.json --no-lock --allow-env --allow-read supabase/functions/_shared/telegram-ocr.test.ts docs/operations/ocr-fixtures/current-ocr-probe.ts`: **17 pass, 0 fail** (12 regression + 5 probe). Có text/empty, thiếu config/media, API/network/malformed, concurrent same-image, failure rồi retry, ảnh khác nhau, namespace fallback và TTL.
- Webhook integration: cùng config/permissions, `--no-check supabase/functions/_shared/telegram-ocr-moderation.test.ts`: **1 pass**. Ảnh benign không bị xóa/hạn chế khi OCR lỗi; caption vi phạm và suspicious URL vẫn bị moderation; flag group vẫn tắt OCR; logs không echo provider body. Đây là runtime assertion pass, không phải typecheck pass.
- Checked integration và `deno check` toàn webhook: **8 TS2345 legacy**. Baseline riêng được xuất bằng `git archive main supabase/functions` ngoài working tree, chạy cùng `deno check` cũng có đúng 8 lỗi: ba FlagKey (`router.strict_mirror`, `group.per_user_history`, `factual.include_user_context`), năm SupabaseClient nominal-type mismatches giữa npm và esm.sh trong channel ingest. Không có lỗi mới được compiler báo; không gọi toàn webhook typecheck đạt.
- Suite Deno rộng: config/permissions trên, `--no-check --ignore=supabase/functions/_shared/managed-groups.test.ts supabase/functions`: **344 pass, 4 fail**. File bỏ qua dùng Bun runner, không thuộc Deno. Bốn assertion legacy có cùng lỗi trên baseline main: `factual mode bỏ qua wit/charm block`; `ensureSettings surfaces insert failures instead of reporting no configuration`; `mention_bait: 2 foreign bots with only emoji/punct → detected`; `detectMeditationInvite: missing required parts is safe`. Baseline **331 pass, 4 fail**. Không sửa các lỗi ngoài phạm vi.
- Frontend không đổi nên không chạy lại `bun test` trong lần sửa này. Kết quả 40/40 của audit trước là lịch sử, không phải lần chạy mới.
- `git diff --check`: **pass**; đã rà tracked diff và từng file mới/probe, kiểm tra whitespace của file untracked và credential-pattern scan, không thấy giá trị secret. Fixture PNG/manifest/cost scenarios và archive có sẵn giữ nguyên. Không sửa generated types, migration, schema/RLS, env/secrets hay webhook configuration.

## Có thể chuyển riêng OCR sang OpenAI không?

Có thể về kỹ thuật: adapter server gửi ảnh data URL tới model hỗ trợ image input, trả cùng hợp đồng OCR; không cần chuyển FUN Core chat. **Chưa triển khai và chưa chọn model thắng benchmark.** Không có key/API call trong diff này.

Giá Standard short-context được kiểm tra lại trên tài liệu chính thức ngày audit:

| Model tham khảo | Input USD/triệu tokens | Output USD/triệu tokens | Nguồn |
|---|---:|---:|---|
| GPT-6 Luna | 0,10 | 0,50 | [Model/giá/modalities](https://developers.openai.com/api/docs/models/gpt-6-luna) |
| GPT-5.6 Luna | 0,20 | 1,20 | [Model/giá/modalities](https://developers.openai.com/api/docs/models/gpt-5.6-luna) |

Theo [OpenAI vision](https://developers.openai.com/api/docs/guides/images-vision), dùng model/detail phù hợp; OCR chữ nhỏ nên đánh giá `original` khi được hỗ trợ. Ảnh được token hóa theo model, không dùng cùng số image tokens cho Gemini và OpenAI. Giữ giới hạn repo 10 MiB; allowlist định dạng và validation phải được thiết kế khi làm adapter.

Trên **cùng PNG/SHA256**, đo usage thực, cộng mọi attempt:

`USD = input_uncached × input_rate / 1e6 + input_cached × cached_rate / 1e6 + billed_output × output_rate / 1e6 + phí cache-write/tier/region khác nếu có`.

Input gồm prompt và image tokens; billed output gồm reasoning khi áp dụng. Đối chiếu Gemini **qua Lovable** bằng Run credits thực; không dùng Google direct rate thay cho hóa đơn Lovable. Bộ fixture/cost scenarios hiện là giả định offline, CER/latency/billing thật vẫn null. Chấm Unicode NFC/CER, dấu tiếng Việt, exact URL/handle/ID, ảnh trống hallucination, moderation recall/false positives và latency theo [quy trình fixture](ocr-fixtures/README.md). Giá niêm yết không chứng minh OpenAI rẻ hơn hoặc chính xác hơn.

Benchmark thật là bước sau, cần operator duyệt chi phí và bộ ảnh sanitized, cấp key trong **Secrets của backend Supabase đang chạy Edge Functions**. Không gửi key vào chat; không đặt ở frontend, `.env` hoặc source. Secret dự kiến `OPENAI_API_KEY`, config tương lai `ANGEL_OCR_PROVIDER`, `ANGEL_OCR_MODEL`: **code hiện chưa đọc chúng**, không cần đặt gì cho diff này. Adapter sau này phải explicit unavailable khi lỗi và không silent Lovable fallback nếu chọn OpenAI.

## Bàn giao

Diff local để review; không commit/push/merge/deploy, không migration hay thay đổi production. Người vận hành review trước khi chọn lịch triển khai riêng; sau triển khai được phép mới đối chiếu metadata error/empty/concurrency và breakdown credits, không mở full prompt/ảnh riêng tư.
