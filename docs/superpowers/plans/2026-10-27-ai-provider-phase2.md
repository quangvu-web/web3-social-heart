# AI provider Giai đoạn 2 — phạm vi đã điều chỉnh

> Thực hiện trực tiếp trong branch `feature/ai-provider-phase2`.

**Goal:** Mở Gemini cho `describeImage` và `ocr`, giữ `caption-translate`; chat giữ Gateway theo quyết định mới của chủ dự án.

**Architecture:** Chỉ mở thêm hai label trong helper hiện tại. Ảnh chỉ được đi direct với hai label này; stream, label khác và model chưa map giữ Gateway. Map hiện có đã được probe ảnh thật trong Bước 0, không cần thêm model. `group-vision` giữ Gateway do payload không trả JSON hợp lệ và đường cũ không được webhook hiện hành gọi.

**Spec:** `docs/operations/ai-provider-phase2-step0.md` và quyết định chủ dự án giữ chat ở Gateway ngày 27/10/2026 (MYT).

## Các bước

- [x] Thêm regression tests vào `ai-provider_test.ts`: ảnh cho hai label mới đi direct; stream/label ngoài phạm vi giữ Gateway; ảnh 429 với maxAttempts=1 fallback đúng payload; ảnh model chưa map giữ Gateway. Chạy để thấy lỗi trước khi sửa.
- [x] Sửa duy nhất điều kiện eligibility trong `ai-gateway-retry.ts`; không sửa retry, timeout, prompt, cache, OCR gate hoặc adapter chat. Chạy lại tests và các regression vision/OCR hiện có.
- [x] Đổi thẻ `AdminFeatureFlagsTab.tsx` thành “Nhà cung cấp AI”, “Dùng key Gemini riêng”; phạm vi dịch phụ đề/đọc ảnh/OCR, ghi rõ chat và câu trả lời YouTube giữ Gateway. Giữ meta.value, TTL, fallback và ẩn cờ khỏi danh sách chung.
- [x] Chạy frontend `bun test src`, build, Edge tests; review diff. Runtime probe dùng đúng helper OCR và media thật; test DM ảnh khi cờ gemini, kiểm tra fallback mock; cuối cùng xác nhận cờ lovable. Không tạo bài đăng kiểm duyệt giả.
- [x] Ghi chính xác phần nghiệm thu đã chạy/chưa chạy, dọn probe, commit tiếng Việt, push. Không merge main.

## Review focus

- Mọi label chat/audio/image-generation và `group-vision` đều ở Gateway dù dùng model đã map.
- `caption-translate` có `image_url` vẫn ở Gateway.
- `describeImage` giữ maxAttempts=1 cho mỗi provider, body Gateway nguyên vẹn khi fallback.
- Không thêm model registry chưa được đường thực tế sử dụng.
- Không đổi OCR/vision cache, FUN Core, transcript YouTube, schema, secret, auth hay quyền admin.

## Kết quả

Xem `docs/operations/ai-provider-phase2-acceptance.md`. Hosted UI reload/DB thật, ảnh nhóm và quan sát call sau hết TTL rollback chưa được nghiệm thu; phải kiểm tra preview trước merge. Chưa merge main.
