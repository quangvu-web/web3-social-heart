# Nối khả năng đọc ảnh vào DM Telegram

## Bước 0 — bằng chứng trước khi sửa luồng DM

- Tìm toàn repo: `describeTelegramImage` và `buildImageAnalysisContext` chỉ có định nghĩa, chưa có nơi gọi.
- DM cũ đã tải attachment để chuyển cho router, nhưng chưa đưa mô tả vision vào prompt. Vì vậy không kết luận rằng DM cũ chỉ nhận caption.
- Truy vấn production cho `cost.vision_describe_enabled` trả về 0 dòng: cờ dùng mặc định `true`; không cần thay đổi dữ liệu.
- Probe tạm, chỉ operator, gọi đúng helper chưa sửa trên ảnh `docs/operations/ocr-fixtures/vietnamese.png`. Model `google/gemini-3.1-flash-lite` mô tả đúng nền trắng và ba dòng chữ: “FUN Profile”, “Cộng đồng yêu thương và kết nối”, “Hẹn gặp lúc 19:00 MYT”. Kết quả quan sát trong Telegram lúc 02:33 MYT ngày 25/10/2026. Probe đã được gỡ khỏi mã và bản triển khai cuối.

## Thiết kế đã triển khai

1. Sau các lệnh hiện hành và rate gate, DM photo chọn ảnh lớn nhất, gọi helper một lần và dùng `buildImageAnalysisContext(description, caption)` cho chat.
2. Vision thất bại: trả lời trung thực rằng lần này chưa đọc được ảnh; không gọi AI để đoán. Log an toàn phân biệt cờ tắt, thiếu cấu hình, tải ảnh lỗi và lỗi model, không ghi token hay base64.
3. Cache 30 phút theo ảnh + model + chat DM, không phụ thuộc caption. Single-flight trong worker và cache bền qua bảng `telegram_ai_response_cache` có sẵn. Namespace `vision:v2`, không cần migration hay đổi RLS. Đã kiểm tra unique `(group_id, cache_key)`, không FK/check trên group_id, chỉ admin đọc bảng qua frontend.
4. Caption bắt đầu bằng `/` không gọi vision. Yêu cầu chỉnh sửa ảnh rõ ràng giữ nguyên đường attachment, không phụ thuộc mô tả vision. Các media khác và OCR moderation nhóm giữ nguyên.
5. Mô tả là dữ liệu khách quan; AI chat thực hiện yêu cầu. Prompt đặt yêu cầu trực tiếp ở đầu, giữ câu cấm phủ nhận nhìn thấy ảnh, yêu cầu soạn tin có thể gửi ngay khi bé nhờ soạn hồi đáp. Ảnh không caption được mô tả và hỏi bé muốn làm gì.
6. Giữ mô tả ảnh trong factual routing, provider recovery và anti-repeat strict mirror. Không dùng stale reply từ một ảnh/câu hỏi trước khi dịch vụ chat lỗi.

## Kiểm thử tự động

- Frontend: `bun test src` — 58 pass, 0 fail.
- Edge: ba file `telegram-vision_test.ts`, `telegram-vision-transport_test.ts`, `dm-vision_test.ts` — 10 pass, 0 fail; chạy Deno với `--no-check --no-lock --node-modules-dir=none --allow-read --allow-env --allow-net`.
- Hồi quy ngôn ngữ nhóm: `group-reply-language_test.ts` và `angel-group-language-transport_test.ts` — 19 pass, 0 fail.
- Phạm vi kiểm thử: chọn ảnh lớn nhất; cache qua worker/caption mới; không chia sẻ cache giữa DM; TTL; cờ tắt; fetch/model lỗi; concurrency trong worker; không đoán khi null; caption lệnh; ảnh không caption; edit độc lập; primary/recovery/anti-repeat giữ nội dung ảnh.
- `deno check` webhook chưa đạt: 8 lỗi có sẵn (3 FlagKey và 5 kiểu client npm/esm.sh không tương thích trong ingestion). Đã chạy cùng lệnh trên bản HEAD gốc trích riêng: cùng 8 lỗi, không phát sinh lỗi mới từ thay đổi này.
- Review độc lập đã phát hiện và sửa mất ngữ cảnh ảnh khi retry và edit bị phụ thuộc vision. Review lại không còn lỗi quan trọng.

## Nghiệm thu trực tiếp

Dùng ảnh mẫu nêu trên và đúng caption của Bé Ly trong DM `@funrich_community_bot`; chưa có ảnh gốc của Bé Ly để đối chiếu.

- 02:44:58 MYT: log `model_success`, nội dung ảnh đọc đúng. Phản hồi đầu chỉ bình luận, chưa soạn tin; đã bổ sung prompt và thử lại.
- 02:46:33 MYT: gửi lại cùng ảnh, log `cache_hit`, `cache: persistent`; không gọi lại vision.
- 02:47:33 MYT: ảnh không caption, tiếp tục `cache_hit/persistent`. Bot chép đúng ba dòng chữ trong ảnh và hỏi muốn làm gì với thông tin này.
- 02:48 MYT: đúng caption “Soạn tin nhắn trả lời cho tin nhắn hình này nhé Angel” → bot soạn nguyên văn tin nhắn cảm ơn lời mời, nhắc đúng FUN Profile, tinh thần cộng đồng và giờ 19:00 MYT. Không phủ nhận khả năng đọc ảnh và không hỏi lại hướng soạn. Đã quan sát ảnh và tin nhắn trong cùng khung chat.

- 02:50 MYT: kiểm tra lại ảnh không caption trên bản cuối: bot mô tả nền trắng, chép đúng ba dòng chữ, rồi hỏi muốn hỗ trợ gì thêm.
- Ảnh bằng chứng cục bộ: `/tmp/dm-image-vision-evidence/telegram-dm.jpg` (không commit lịch sử chat).

## Tích hợp

Chỉ commit các file vision/DM và tài liệu này. Giữ nguyên patch MCP có sẵn. Webhook đã triển khai để nghiệm thu trước khi tích hợp main; không thay đổi schema hay cài đặt production.
