# Công tắc provider AI — nghiệm thu Giai đoạn 1

Ngày 27/10/2026, Malaysia Time (UTC+8). Branch `feature/ai-provider-gemini`, code triển khai `0ad6a88`, function `angel-caption` version 35 ACTIVE. Không migration; không sửa secret, prompt, vai trò model, DM/nhóm, vision/ảnh/OCR. Chỉ `caption-translate` text có thể direct. Giai đoạn 2 chưa mở.

## Bước 0 và bảng map cuối cùng

Key mới có trong runtime; không xuất giá trị. Catalog OpenAI-compatible của Google trả HTTP 200. Flag `ai.provider` chưa tồn tại trước thay đổi.

| Gateway id | Native id đã gọi thành công | Bằng chứng |
|---|---|---|
| `google/gemini-3.1-flash-lite` | `models/gemini-3.1-flash-lite` | POST `v1beta/openai/chat/completions`: HTTP 200; `choices[0].message.content` khác rỗng; 1.377 ms |

Native ID này được lấy từ catalog của key và dùng đúng ID đó trong completion thành công. Không strip `google/` tự động, không đoán map cho override. Các model flash-lite-latest/2.5-flash-lite/3.1-flash-lite-preview cũng đã thử thành công để kiểm tra key nhưng không dùng để mở thêm vai trò. Probe tạm chỉ trả metadata, có token băm và thời hạn; đã xóa khỏi backend và xóa token local. Không lưu key/token vào git.

## Hợp đồng runtime

Bảng flags hiện có `enabled` và `meta`, không có cột giá trị chuỗi. Lưu công tắc bằng:

```json
{"key":"ai.provider","enabled":true,"meta":{"value":"gemini"}}
```

Để về Gateway: `meta.value="lovable"` hoặc `enabled=false`. Không có row/giá trị sai cũng về lovable. Chỉ lỗi đọc DB/client mới dùng env `AI_PROVIDER`; env không hợp lệ vẫn lovable. Cache 60 giây như kho flags hiện hành, không cần deploy khi đổi flag. Các boolean flag/meta cũ có regression test.

Routing tập trung trong `callAiGateway`: Gateway dùng key/`opts.apiKey` cũ; Gemini chỉ dùng `GEMINI_API_KEY` và model allowlist. Các label khác, request có `image_url` hoặc `stream=true` vẫn Gateway. Mỗi provider giữ timeout, maxAttempts và backoff caller truyền. Thiếu key/unmapped model về Gateway ngay. Direct lỗi sau retry (auth/429/5xx/network/timeout/response rỗng hoặc sai) về Gateway bằng body/model ban đầu; không nhân bản bản dịch/insert. Log ghi `provider_fallback`, reason/status và provider/model/label; không log direct error body/key.

`cloud_usage_events` vẫn một event/handler. Metadata có `provider`, `ai_providers`, `ai_attempts` (attempt HTTP thực tế, không giả vờ là token/credit). Dùng async context riêng từng request. Tác vụ waitUntil sau ACK cập nhật metadata đúng event ID bằng update tuần tự; không thêm event, không làm webhook chờ AI nền. Tracking vẫn best-effort nếu DB lỗi.

Một số caller text cũ dùng fetch trực tiếp, ví dụ `angel-core.ts`; chúng vẫn Gateway. Không tuyên bố mọi caller đã được chuyển qua helper, không tự refactor ngoài Giai đoạn 1.

## Nghiệm thu thật: hbjhsvfvf3e8

Phiên do bé chọn, xác nhận live. Không chèn transcript giả, không restart bot hay thay logic phiên.

- **Gateway mặc định:** trước bật flag, các dòng 22–24 được insert lúc 01:44:28–01:44:34. Log `caption-translate`, model Gateway, provider lovable; usage IDs `147842`, `147845`, `147846`, mỗi event một attempt lovable. Đã mở AI activity trên Lovable project hiện hành và thấy đúng ba câu đối chứng, model `google/gemini-3.1-flash-lite`.
- **Bật Gemini:** tạo flag lúc **01:45:13.682 MYT**, `enabled=true,meta.value=gemini`. Các dòng 25–46 tiếp tục tới; log thực ghi `provider=gemini,model=models/gemini-3.1-flash-lite,label=caption-translate,attempt=1`. Usage IDs có `147851`, `147854`, `147868`, `147900`…`148002`, provider gemini, một attempt/event trong mẫu kiểm tra.
- **Không mất/thứ tự:** export cửa sổ seq 22–46 có 25 dòng, seq liên tiếp, ID duy nhất, cả text_vi/text_en khác rỗng. Có dịch hai chiều. Ví dụ: “mọi người giỏi lắm nha.” → “You are all doing great.”; “Where are you from?” → “Bạn đến từ đâu?”. Các câu rõ nghĩa giữ được ý ở mẫu thủ công; không tuyên bố đánh giá chất lượng thống kê. Vài câu ASR đầu vào vốn rời/nhầm từ vẫn dịch gượng, ví dụ “ngồi hay là trong nước”; không sửa ASR/hearing corrections/prompt ngoài phạm vi.
- **Nhãn khác khi flag gemini:** probe runtime riêng dùng đúng helper/registry với prompt smoke tổng hợp, không xuất bản chat/tóm tắt vào nhóm. `caption-summarize` → lovable, `google/gemini-3.1-flash-lite`, HTTP 200; `chat` → lovable, `google/gemini-3.6-flash`, HTTP 200. Hai call này cũng xuất hiện trên AI activity Lovable. Đây là kiểm tra routing thật, không phải nghiệm thu nội dung một cuộc chat hay một bản tóm tắt mới.
- **Trạng thái cuối:** CAS trả `meta.value` về **lovable lúc 01:50:56.875 MYT**; đọc lại xác nhận, session vẫn live. Không để Gemini làm mặc định sau thử. Cache có thể giữ lựa chọn cũ tối đa 60 giây. Sau lúc restore chưa có segment mới ở lần đo cuối; không giả vờ đã quan sát thêm call rollback.
- **AI activity:** các call direct không xuất hiện trong danh sách Lovable; đó là hành vi đúng. Danh sách đã quan sát hiển thị baseline và hai smoke call Gateway, không có các câu direct trong cửa sổ thử. Đọc log provider/DB usage để theo dõi direct; chi phí/quota direct thuộc Google. Gateway fallback vẫn ghi vào Lovable.

## Kiểm thử lỗi và hồi quy

- **17 provider/usage tests pass:** HTTP boundary giả, default, env chỉ khi lỗi đọc, flag disabled/boolean/meta cũ, allowlist, thiếu key, auth401,429,503, network, timeout, response rỗng, prototype property, logging an toàn, metadata background và request isolation. Thiếu key được giả lập bằng xóa key giả khỏi process test; không gỡ key production. 429 direct hai attempts rồi một Gateway thành công, body/model Gateway nguyên vẹn và có provider_fallback.
- **104 caption tests pass**, có fixture thật dry-run nhưng không dùng mock làm chứng cứ live.
- **19 webhook runtime tests pass** với `--no-check`. Typed suite có 9 lỗi tái hiện trên baseline: 3 FlagKey cũ, 1 Timeout type, 5 SupabaseClient npm/esm identity. Không gọi typed suite pass.
- Shared modules `deno check`: pass. Caption entrypoint còn 5 lỗi baseline (3 FlagKey, 2 Response playback).
- Frontend `bun test src`: **59 pass**; build thành công. Bare `bun test`: 62 pass, 70 fail/error do Bun không nạp Deno imports/globals; không gọi toàn repo pass.
- Review độc lập đã phát hiện lỗi mất metadata background, có RED→GREEN trước sửa; review lại không còn finding cụ thể. Diff không có whitespace lỗi, file version build tự sinh đã restore.

Tài liệu endpoint: [Google OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai). Schema/migration và secret production giữ nguyên; chỉ runtime flag được bật/thôi thử theo yêu cầu nghiệm thu.
