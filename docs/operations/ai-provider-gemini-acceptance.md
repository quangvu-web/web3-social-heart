# Công tắc provider AI — Giai đoạn 1

Ngày 27/10/2026 MYT, branch `feature/ai-provider-gemini`. Không migration; không đổi secret, prompt, vai trò model, DM/nhóm, vision/ảnh/OCR. Chỉ label `caption-translate` text được chọn direct.

## Bước 0

Key mới có trong runtime; không xuất giá trị. Catalog Google OpenAI-compatible trả200; thử completion thật với cùng key:

| Gateway id | Native id đã gọi thành công | Bằng chứng |
|---|---|---|
| google/gemini-3.1-flash-lite | models/gemini-3.1-flash-lite | POST v1beta/openai/chat/completions HTTP200; nonempty choices[0].message.content;1377ms |

Đây là ID native resource trả từ catalog và đã dùng đúng ID đó trong completion thành công. Không stripgoogle/ tự động, không map các override chưa kiểm chứng. Các model flash-lite-latest/2.5-flash-lite/3.1-flash-lite-preview cũng thử thành công để kiểm tra key, nhưng không mở thêm vai trò hoặc dùng làm model thay thế. Function probe tạm có token băm, thời hạn và chỉ trả metadata; đã xóa khỏi backend sau kiểm tra. Không lưu token/key vào repo.

Flag `ai.provider` chưa tồn tại trước sửa; mặc định vẫnlovable. `getFlag` hiện có bảng enabled+meta nên kiểu provider được lưu bằng `enabled=true,meta={"value":"gemini"}`. Disabled, thiếu row hoặc value không hợp lệ=>lovable. Chỉ lỗi DB/client đọc flag mới dùng envAI_PROVIDER (hợp lệgemini, còn lạilovable). Cache60s như kho flags hiện hành, không cần deploy khi đổi flag. Các booleanflag giữ hợp đồng.

## Hành vi

- Routing tập trung callAiGateway. Gateway dùng key/opts.apiKey hiện hành. Gemini chỉ lấy GEMINI_API_KEY và model allowlist, chỉ labelcaption-translate; request có image_url hoặcstream vẫnGateway; summarize/chat/OCR không direct.
- Mỗi provider giữ đúng timeout/maxAttempts/backoff như caller truyền. Direct thất bại (auth,429,5xx,network,timeout,response rỗng/sai) => một luồng Gateway với body/model gốc và cấu hình retry cũ. Không nhân bản bản dịch/insert.
- Thiếu key/unmapped model=>Gateway ngay, có provider_fallback và reason. Không log direct errorbody/key. Log AI có provider/model/label/attempt. Result thêm provider/model, giữchoicesđểcaller parse như cũ.
- Usage vẫn một event/handler như cũ. Metadata thêmprovider,ai_providers,ai_attempts đếm requestattempt thực tế; mixed khi dùng cả hai. AsyncLocalStorage tách requestđồng thời. Tác vụwaitUntil sauACK cập nhậtmeta đúng eventid, update tuần tự; không thêm event hoặc giữ webhook chờ. Tracking vẫn best-effort khi DB lỗi.
- Có callertext cũ dùngfetch trực tiếp, ví dụangel-core.ts; các đường này vẫnGateway, không tự refactor hoặc tuyên bố chúng đã chuyển qua helper. Giai đoạn2 CHƯA mở.
- CallGemini trực tiếp sẽ KHÔNG có trong bảngAIactivity củaLovable; đó là hành vi đúng. Theo dõi logprovider vàcloud_usage_events; chi phí/quota direct thuộcGoogle. Gateway fallback vẫn xuất hiện ởLovable.

## Kiểm thử

- Provider/usage:16 pass,0fail; networkboundary thật vớiHTTP giả; default,env-only-on-read-error,allowlist,missingkey,401/429/503/network/timeout,malformed/empty completion,prototype key,metadata background và isolation.
- Caption:104 pass,0fail (fixture thật dry-run được ghi riêng, không coi mock lànghiệm thuAI).
- Webhook runtime với --no-check:19 pass,0fail. Typed webhook suite có9 lỗi, tái hiện đầy đủ trên bản HEAD trước sửa:3 FlagKey cũ,1 kiểuTimeout,5 SupabaseClientnpm/esm identity. Không gọi typed suitepass.
- Shared modules denocheck:pass. Frontend bun test src:59pass,0fail; build:thành công. Bare bun test:62pass,70fail/error doBun không nạp Deno imports/globals; không gọi toànrepo pass.
- Review độc lập sửa lỗi mất metadata background bằng testRED→GREEN; reviewlại không còn finding cụ thể.

## Nghiệm thu live

Phiên do bé chọn:hbjhsvfvf3e8, xác nhận trạng tháilive trước triển khai. Chưa đánh dấu đạt cho tới khi đối chiếu DB lines/log provider/usage thật. Kế hoạch:deploy riêngangel-caption, baselineflag vắng=>lovable, bậtgemini trong cửa sổ thử, theo dõi đủ dòngdịch/seq và nhãnkhácGateway; sau đóCAS trả flagvềlovable. Không gỡkey hoặc gây429 trênproduction để thử; lỗi giảlập chỉ test.
