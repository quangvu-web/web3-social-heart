# Vì sao bot Telegram vẫn tốn credit dù đã nối key Angel AI gốc

## Kết luận kiểm tra

Câu trả lời chính của bot đã đi qua Angel AI gốc (provider bị khoá cứng = `funcore` trong `angel-core.ts`). Nhưng vẫn còn **nhiều lớp phụ trợ gọi thẳng Lovable AI Gateway** bằng `LOVABLE_API_KEY`. Đó là chỗ đang trừ credit.

Bằng chứng từ log AI Gateway (7 ngày gần nhất): 230 request, xen kẽ hai nhóm model
- `google/gemini-3-flash-preview` — request nặng, ~5.000–6.400 token vào, ~0,012–0,017 credit/lần (ví dụ log_id `019fdd24-ea1c-762b-853c-d7e4e31f8f33`, 2026-08-07T16:53:37Z).
- `google/gemini-3.1-flash-lite` — request nhẹ, ~900–1.400 token vào, ~0,001–0,008 credit/lần (ví dụ log_id `019fdeab-fe67-770d-8d54-fedf6493b99f`, 2026-08-08T00:00:43Z).

### Các nguồn tốn credit (đã xác định trong code)

| Nguồn | File | Khi nào chạy |
|---|---|---|
| Interpret-retry (khi Angel gốc trả rỗng/không hiểu) | `_shared/telegram-community.ts` — `forceProvider: "lovable"` | mỗi lần reply rỗng → sinh nguyên câu trả lời trên Lovable |
| Anti-repeat retry (DM) | `_shared/telegram-community.ts` — force Lovable, temperature 0.95 | khi reply trùng reply cũ |
| Post-process style pass + sửa lời thoại nhân vật | `_shared/angel-postprocess.ts` | gần như mỗi reply group / DM dài ≥400 ký tự |
| Restyle + language repair | `_shared/telegram-community.ts` | khi admin set style prompt / reply sai ngôn ngữ |
| Trích xuất trí nhớ dài hạn | `_shared/angel-memory.ts` | định kỳ mỗi vài lượt chat |
| Rolling summary | `_shared/angel-rolling-summary.ts` | khi hội thoại vượt ngưỡng |
| Mô tả ảnh (vision) + transcribe voice | `_shared/telegram-community.ts` | mỗi ảnh / voice gửi vào bot |
| Phân loại JSON (moderation, intent) | `angel-core.ts`: `if (p.json) return callLovable(p)` | mỗi lần cần JSON strict |
| Distill/enrich prompt vẽ ảnh, fallback tạo ảnh | `_shared/angel/image-distill.ts`, `angel-image*.ts` | mỗi lần vẽ ảnh |

Tóm lại: **key Angel AI gốc chỉ phụ trách "bộ não trả lời"; toàn bộ lớp trang điểm, trí nhớ, thị giác, phân loại vẫn chạy trên credit Lovable.**

## Đề xuất xử lý

### Bước 1 — Bảng điều khiển tiết kiệm (Admin UI, tab Angel)
Thêm nhóm cờ bật/tắt trong `angel_settings` + UI, để Cha con tự chốt cái nào giữ:
- `cost.postprocess_enabled` (mặc định BẬT)
- `cost.memory_extract_enabled`
- `cost.rolling_summary_enabled`
- `cost.vision_describe_enabled`
- `cost.voice_transcribe_enabled`
- `cost.lovable_retry_enabled` (interpret-retry + anti-repeat retry)

Khi tắt: bỏ qua lớp đó, giữ nguyên reply gốc từ Angel AI — không hỏng luồng.

### Bước 2 — Chuyển các lớp phụ về Angel gốc khi có thể
- Interpret-retry và anti-repeat retry: đổi từ `forceProvider: "lovable"` sang gọi lại Angel gốc (`funcore`) với temperature cao; chỉ rơi về Lovable khi Angel gốc lỗi 2 lần liên tiếp.
- Post-process style pass: mở rộng điều kiện "TẦNG B skip" cho cả group (hiện chỉ DM <400 ký tự), nâng ngưỡng lên ~700 ký tự → cắt phần lớn call nặng.

### Bước 3 — Giảm chi phí phần còn buộc phải dùng Lovable
- Hạ model vision/transcribe từ `gemini-3-flash-preview` xuống `gemini-3.1-flash-lite` (rẻ hơn ~5–10 lần cho việc mô tả ảnh).
- Cắt bớt prompt post-process (hiện gửi 5.000–6.400 token/lần) bằng cách chỉ gửi phần rule cần thiết theo ngữ cảnh.

### Bước 4 — Đo lại
Sau khi triển khai, đối chiếu tab "AI activity" trong 24h để xác nhận số request/ngày và credit giảm.

## Ghi chú kỹ thuật
- Không đụng vào luồng RAG gửi sang Angel gốc — mọi thay đổi chỉ ở lớp hậu xử lý output và các call phụ trợ.
- Không đụng bot Telegram 2FA.
- Mỗi cờ mới đều có giá trị mặc định giữ nguyên hành vi hiện tại, trừ những cờ Cha con chốt tắt.
