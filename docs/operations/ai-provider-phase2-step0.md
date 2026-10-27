# AI provider Giai đoạn 2 — kết quả Bước 0, chưa mở routing

> Snapshot điều tra trước khi sửa. Chủ dự án sau đó chọn giữ chat ở Gateway; kết quả triển khai phạm vi đọc ảnh/OCR nằm trong [nghiệm thu Giai đoạn 2](./ai-provider-phase2-acceptance.md).

Ngày 27/10/2026, Malaysia Time (UTC+8). Base `d5adc5d`, khớp `origin/main` sau fetch. Branch `feature/ai-provider-phase2`.

**Chưa triển khai Giai đoạn 2.** Có khác biệt giữa tiền đề yêu cầu và đường chat thực tế cần chủ dự án quyết định. Chỉ bổ sung báo cáo và bằng chứng; không đổi code sản phẩm, bảng map, UI, schema, secret hay cờ production.

## Label và model thực tế

| Đường gọi | Label qua `callAiGateway` | Model | Bằng chứng cấu hình |
|---|---|---|---|
| Dịch phụ đề | `caption-translate` | `google/gemini-3.1-flash-lite` | Phạm vi Giai đoạn 1 giữ nguyên |
| Mô tả ảnh DM/nhóm | `describeImage` | `google/gemini-3.1-flash-lite` | Runtime không có `ANGEL_MODEL_VISION`; giữ `maxAttempts: 1` |
| OCR | `ocr` | `google/gemini-3.1-flash-lite` | Hardcode trong `telegram-ocr.ts` |
| Phân loại ảnh cũ | `group-vision` | `google/gemini-2.5-flash` | Hardcode trong `telegramGroup.ts`; yêu cầu JSON, `max_tokens: 100` |
| Chat từ `askAngel` | **Chưa có label qua helper** | Nhánh `callLovable`: `google/gemini-3-flash-preview` nếu không truyền `p.model` | `angel-core.ts:135–155`, `telegram-community.ts:3121`; source đang deploy khớp repo |

Probe chạy trong project production xác nhận `ANGEL_MODEL_CHAT_PRIMARY` và `ANGEL_MODEL_CHAT_BACKUP` đều không được đặt. Registry trả `google/gemini-3.6-flash` / `google/gemini-3.5-flash`, nhưng `angel-core.ts` không dùng registry cho nhánh `callLovable`. Vì vậy activity ghi `google/gemini-3-flash-preview` có thể được giải thích bằng chính mặc định adapter; không có bằng chứng env override như giả thuyết ban đầu.

`askAngel → callAngelCore` mặc định khóa FUN Core; creative/YouTube off-ramp có thể ép nhánh Lovable. `callLovable` dùng `fetch` trực tiếp, chưa gọi `callAiGateway`. Chỉ thêm label `chat` vào allowlist sẽ không chuyển nhà cung cấp cho chat. Chuyển nhánh này qua helper cần xem xét cả timeout/retry: fetch hiện tại không đặt timeout hoặc retry, còn helper có mặc định 60 giây / 3 attempts. Không tự thay đổi hợp đồng này.

`group-vision` tồn tại trong code nhưng là hàm phân loại moderation cũ, không phải label mô tả ảnh khi được nhắc. Tìm reference cho thấy `aiClassifyMultimodal` chỉ được giữ bằng `void aiClassifyMultimodal`; module không nằm trong bundle `telegram-community-webhook` vừa tải từ production. Log `[group-vision] skipped` trong webhook không chứng minh có AI call với label này. Không tự nối lại đường moderation cũ để tạo nghiệm thu.

## Probe thật bằng `GEMINI_API_KEY` production

Catalog `GET /v1beta/openai/models` trả HTTP 200. Native IDs dưới đây đều có trong catalog. Completion dùng `POST /v1beta/openai/chat/completions` với chính key runtime, không xuất giá trị key. Ảnh là PNG thật `src/assets/fun-profile-logo.png`, gửi theo `image_url.url = data:image/png;base64,...`. Prompt mô tả/OCR/group classification giữ nội dung đang có trong source; group giữ JSON format và giới hạn 100 tokens.

| Gateway id ứng viên | Native id từ catalog | Probe | Kết quả, khoảng 23:08:29–23:08:34 MYT |
|---|---|---|---|
| `google/gemini-3.1-flash-lite` | `models/gemini-3.1-flash-lite` | Ảnh, prompt `describeImage` | HTTP 200, 2.170 ms; mô tả logo và chép đúng FUN / Profile / WEB3 |
| `google/gemini-3.1-flash-lite` | `models/gemini-3.1-flash-lite` | Ảnh, prompt `ocr` | HTTP 200, 1.947 ms; `FUN\nProfile\nWEB3` |
| `google/gemini-2.5-flash` | `models/gemini-2.5-flash` | Ảnh, payload `group-vision` | HTTP 200, 2.193 ms; `Here is the`, không phải JSON |
| `google/gemini-3-flash-preview` | `models/gemini-3-flash-preview` | Text | HTTP 200, 1.854 ms; `5` |
| `google/gemini-3.6-flash` | `models/gemini-3.6-flash` | Text, kiểm tra registry | HTTP 200, 3.393 ms; `Bằng 5.` |
| `google/gemini-3.5-flash` | `models/gemini-3.5-flash` | Text, kiểm tra registry | HTTP 200, 3.646 ms; `Bằng 5.` |

Lần gọi lại payload `group-vision` trả HTTP 200, 1.971 ms, nội dung `Here`, `finish_reason=length`. Có nội dung khác rỗng nhưng chưa đạt hợp đồng JSON của caller. Không tự tăng token budget, thay model hay prompt. Đề xuất giữ đường này trên Gateway tới khi có quyết định riêng; không dùng HTTP 200 để tuyên bố kiểm duyệt đã hoạt động.

Bằng chứng có cấu trúc: [ai-provider-phase2-step0-evidence.json](./ai-provider-phase2-step0-evidence.json). Đây là probe endpoint/model thật, **không phải** nghiệm thu DM/nhóm/YouTube, không phải probe chạy đúng helper OCR, và không chứng minh provider routing mới.

## Bảng map đang có và phạm vi còn ở Gateway

Bảng `GEMINI_TEXT_MODELS` chưa đổi:

| Gateway id | Native id |
|---|---|
| `google/gemini-3.1-flash-lite` | `models/gemini-3.1-flash-lite` |

`describeImage`, `ocr`, `group-vision` vẫn ở Gateway do cổng Giai đoạn 1. Nhánh chat Lovable vẫn fetch Gateway trực tiếp; nhánh FUN Core giữ nguyên. Các model registry thử thành công không tự được thêm vào map vì không phải model được nhánh chat thực tế dùng. `transcribeAudio`, tạo ảnh và lấy transcript YouTube không đổi.

## Quyết định cần có trước khi triển khai

Chủ dự án chọn có cho phép chuyển riêng `callLovable` trong `angel-core.ts` sang helper với label `chat` hay giữ chat ở Gateway đợt này. Nếu chuyển, phải chốt cách bảo toàn timeout/retry và giữ nhánh JSON moderation ngoài label chat, tránh vô tình mở thêm tác vụ dùng chung adapter. Giữ nguyên FUN Core, model thực tế và prompt. Nếu chỉ mở vision/OCR trước, ghi đúng phạm vi đang chạy trên thẻ UI, không hiển thị cam kết chat chưa được nối.

Sau quyết định: viết regression test cho allowlist ảnh/text/stream, label ngoài phạm vi, model chưa map và fallback ảnh 429; mở đúng đường đủ điều kiện; kiểm tra UI theo `meta.value`; deploy/test DM, nhóm và YouTube có transcript; dùng đúng OCR helper trong probe runtime; tạm bật cờ khi nghiệm thu rồi CAS trả `lovable`; review diff, commit tiếng Việt, push và kiểm tra preview trước merge. Không migration.

## Kiểm thử và dọn dẹp

- Edge Function baseline: `deno test --allow-env --allow-net supabase/functions/_shared/ai-provider_test.ts` — **16 passed, 0 failed**. Chưa có thay đổi routing để gọi đây là test Giai đoạn 2.
- Frontend: chưa chạy `bun test` hoặc build; không sửa frontend.
- Cờ đọc được trước thử: `enabled=true, meta.value="lovable"`. Probe không có thao tác ghi DB hoặc đổi cờ; không cần rollback cờ.
- Probe tạm có bearer ngẫu nhiên chỉ lưu local mode 0600; backend lưu SHA-256 và hạn dùng một giờ. Không thay secret. Sau thử đã xóa function `ai-phase2-probe`, source tạm và bearer local. Không giữ endpoint probe trong repo.
- Đã tải source production của `telegram-community-webhook` vào thư mục tạm để đối chiếu; `angel-core.ts`, `telegram-community.ts`, `telegram-ocr.ts` khớp byte với repo. Không triển khai lại webhook.
