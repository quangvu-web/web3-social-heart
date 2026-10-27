# AI Provider — ba công tắc dịch vụ

Ngày 28/10/2026, Malaysia Time (UTC+8). Branch `feature/ai-provider-per-service`, base `fbe11f5`.

## Nguồn điều khiển mới

| Label | Cờ duy nhất |
|---|---|
| `caption-translate` | `ai.provider.caption` |
| `describeImage` | `ai.provider.vision` |
| `ocr` | `ai.provider.ocr` |

Chỉ `enabled=true` và `meta.value="gemini"` mới chọn Gemini. Thiếu row → lovable kèm `provider_flag_missing` có key/label, kể cả cache hit. Lỗi đọc → lovable kèm `provider_flag_unreadable`. Không fallback sang cờ cũ hay env `AI_PROVIDER`. Nhãn khác trả lovable mà không query cờ. Không còn caller của `resolveAiProvider()` cũ; caller duy nhất trong Gateway đã đổi sang `resolveAiProviderForLabel(label)`.

**`ai.provider` đã nghỉ hưu:** vẫn nằm nguyên trong database, không bị migration hay test sửa/xóa, nhưng đổi nó không còn tác dụng cho ba dịch vụ. UI mới ẩn cả bốn key khỏi danh sách chung và chặn tạo chúng từ form cờ tổng quát. Nếu mở frontend cũ trước khi merge/publish UI mới, công tắc tổng cũ vẫn có thể xuất hiện nhưng không còn điều khiển backend; phải dùng ba cờ con.

Giữ nguyên model/map, prompt, timeout, retry, fallback từng call, OCR conditions/empty response, cache vision, chat/FUN Core, group-vision, transcript YouTube, stream/image gates, auth/roles/RLS và secret.

## Migration trước deploy

Codex chỉ soạn file migration mới, không thực thi migration. Bé xác nhận đã chạy; SQL Editor đang mở cũng hiển thị `Success. No rows returned` cho SQL migration. Probe chỉ đọc kiểm tra dữ liệu trước khi deploy hai function chính.

| Key | enabled | meta | updated_at (MYT), quan sát trước test |
|---|---|---|---|
| `ai.provider` | true | `{"value":"lovable"}` | 27/10/2026 23:48:31.710 |
| `ai.provider.caption` | true | `{"value":"lovable"}` | 28/10/2026 04:28:37.496 |
| `ai.provider.vision` | true | `{"value":"lovable"}` | 28/10/2026 04:28:37.496 |
| `ai.provider.ocr` | true | `{"value":"lovable"}` | 28/10/2026 04:28:37.496 |

Quan sát lúc **04:33:57 MYT**: ba row mới bằng nguyên enabled/meta của nguồn; nguồn giữ updated_at của lần rollback Giai đoạn 2. Snapshot nguồn trước đó đã ghi true/lovable trong nghiệm thu Giai đoạn 2; lần này Codex không có SELECT ngay sát thời điểm bé chạy SQL. Không dùng snapshot sau để giả vờ là một SELECT trước migration mới. SQL khóa row nguồn, copy enabled/meta live trong cùng transaction, `ON CONFLICT DO NOTHING`; row đích có sẵn không bị ghi đè. Không hardcode nhà cung cấp hoặc tạo table/schema/grant mới. Hướng dẫn: [migration](./ai-provider-per-service-migration.md).

## Nghiệm thu runtime

Sau khi xác minh ba row mới tồn tại và bằng nguồn, đã deploy `angel-caption` và `telegram-community-webhook` với helper mới. Probe có bearer ngẫu nhiên, hash ở backend, hạn hai giờ, chỉ cho CAS đúng ba key con và các smoke call được giới hạn. Mỗi thay đổi có matched count 1, giữ các metadata khác; restore theo snapshot enabled/meta ban đầu. Không tạo cờ tổng/override mới.

| Tổ hợp / thử lỗi | caption-translate | describeImage | ocr |
|---|---|---|---|
| Ban đầu | lovable | lovable | lovable |
| Chỉ bật caption, 04:35:59 | gemini | lovable | lovable |
| Bật thêm vision, 04:36:05 | gemini | gemini | lovable |
| Mock 429 cho call vision | gemini | lovable (fallback đúng call) | lovable |
| Call tiếp theo sau 429 | gemini | gemini | lovable |
| Bật thêm OCR, 04:38:28 | gemini | gemini | gemini |
| Trả caption, 04:38:32 | lovable | gemini | gemini |
| Trả vision, 04:38:36 | lovable | lovable | gemini |
| Trả OCR, 04:38:41 | lovable | lovable | lovable |

27 kết quả label trong chín stage đều thành công. Log từng stage có provider/model/label, xem [bằng chứng runtime](./ai-provider-per-service-runtime-evidence.json). Caption/vision ở bảng là helper smoke call thật, không phải segment phiên họp hoặc ảnh DM. OCR gọi đúng `runOcrOnPhoto`, với HTTP tải media Telegram thay bằng PNG logo thật; AI và DB flags đều thật. OCR trả `FUN\nProfile\nWEB3`. Probe invalidate cache của chính isolate để đọc đúng tổ hợp mỗi lượt; không sửa TTL của function production.

**Ảnh DM thật:** gửi logo kèm caption “Angel đọc giúp bé chữ trong logo này và cho biết màu của từng dòng chữ nhé.” khi caption và vision Gemini, OCR vẫn lovable. Log webhook **04:37:15 MYT** ghi `provider=gemini, label=describeImage, model=models/gemini-3.1-flash-lite, attempt=1`. Đã đọc câu trả lời trên Telegram: FUN trắng, Profile vàng, WEB3 trắng. Chat sau bước vision giữ đường hiện hành. Không gửi bài đăng kiểm duyệt giả.

**429:** chỉ HTTP Gemini của call vision được mock 429; Gateway fallback thực trả 200, caption vẫn Gemini, OCR vẫn lovable. Call vision tiếp theo lại Gemini. Không thay khóa production để tạo lỗi.

**Trạng thái cuối, đọc lại 04:38:52 MYT:** cả ba key true/lovable, bằng đúng enabled/meta trước test; legacy row giữ nguyên cả enabled/meta/updated_at. Cache production có thể giữ giá trị cũ tối đa 60 giây.

## UI và kiểm thử

Thẻ Nhà cung cấp AI có ba hàng riêng, mỗi hàng có công tắc, trạng thái và thời gian riêng theo đúng row. Lưu mỗi key có revision/saving guard riêng, upsert đúng row, select riêng sau ghi; toast success chỉ khi enabled/meta đọc lại khớp. Lượt tải cũ không ghi đè kết quả mới. Lỗi một hàng không khóa hai hàng khác. Giữ ghi chú độc lập, ~60 giây, AI activity, fallback và phạm vi không áp dụng chat/YouTube/tóm tắt.

- Frontend `bun test src`: **65 pass, 0 fail**, gồm sáu test component thực với DB fixture: ba row/timestamp, bốn key ẩn, ghi riêng/select riêng, remount, lưu đồng thời, duplicate guard, stale load, readback mismatch và readback failure/recovery. Reviewer độc lập chạy lại sáu test này: pass.
- Edge provider `deno test --allow-env --allow-net supabase/functions/_shared/ai-provider_test.ts`: **27 pass, 0 fail**. Năm regression mới/điều chỉnh fail đúng trên resolver cũ trước sửa, sau sửa pass. Kiểm tra legacy/env không tác dụng, cached missing audit, nhãn ngoài không query, từng tổ hợp cờ và 429 độc lập.
- Edge vision/OCR: **20 pass, 0 fail** bằng Deno với `--no-lock --node-modules-dir=none --no-check --allow-env --allow-net --allow-read`, bốn suite như Giai đoạn 2. Không gọi typed suite pass.
- `deno check` ai-provider.ts, ai-gateway-retry.ts, angel/flags.ts: pass. `bun run build`: exit 0, warnings dependency/bundle cũ; không đổi deps. File version/lock tự sinh được restore.
- Bare `bun test`: **68 pass, 70 fail/errors**, do các file Deno imports/globals không chạy dưới Bun như baseline; không gọi toàn repo pass.
- Review độc lập không có finding correctness/security. Chưa merge main.

## Phần còn chờ

Backend không có phiên `live` khi kiểm tra 04:33:57; đã nhờ bé gửi mã/link phiên thật. Chưa dùng probe smoke thay cho nghiệm thu caption từ phiên họp thật. Frontend vẫn trên feature branch: chưa có bằng chứng reload browser của UI mới với DB production; test remount hiện dùng DB fixture. Chưa tuyên bố hai phần nghiệm thu này hoàn tất. Không bỏ guard hoặc chấp thuận điều khoản để ép vào admin.
