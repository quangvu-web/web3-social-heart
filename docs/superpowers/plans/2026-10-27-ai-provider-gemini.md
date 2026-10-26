# Provider Gemini — Giai đoạn 1

Spec: yêu cầu chủ dự án ngày 27/10/2026 MYT. Thực hiện trực tiếp theo phương án đã chốt: Gateway mặc định/fallback; chỉ caption-translate được direct; không mở Giai đoạn 2.

- [x] Bước 0: key có trong runtime; flag chưa tồn tại; catalog200; model `models/gemini-3.1-flash-lite` completion200, nonempty choices content,1377ms. Map duy nhất từ `google/gemini-3.1-flash-lite`.
- [x] Test RED→GREEN routing thật ở HTTP boundary: mặc địnhGateway, chỉ caption-translate direct, nhãn khác/image_url/stream Gateway; missingkey/unmapped/auth/429/5xx/network/timeout/empty fallback giữ body/model/options; không lộ key.
- [x] Extend getFlag kiểu provider qua enabled + meta.value, cache60s; thiếu/invalid =>lovable; lỗi đọc mới dùng AI_PROVIDER. Boolean/meta cũ có regression test.
- [x] Router tập trung callAiGateway, logging provider/model/label. Không sửa prompt hoặc caller riêng lẻ.
- [x] Metadata usage theo async context riêng request; giữ một event; background waitUntil cập nhật event đó sau ACK. Review bắt lỗi background và có RED→GREEN trước sửa.
- [x] 17 provider/usage,104caption,19webhook-runtime,59frontend tests pass; build/sharedcheck pass. Lỗi typed baseline/root Bun ghi riêng trong báo cáo operations.
- [x] Review, commit/push PR32; deploy riêng angel-caption version35. Live hbjhsvfvf3e8: seq22–46 đủ25dòng, hai ngôn ngữ; baselineGateway/directGemini có log+usage. Nhãn summarize/chat smoke thật vẫnGateway khi flaggemini; đã đọcAIactivityLovable.
- [x] CAS trả flag vềlovable sau thử; probe/token tạm đã xóa. Không migration, ảnh/OCR/auth/secrets change. Chưa tự merge và chưa mở Giai đoạn2.

Chi tiết: docs/operations/ai-provider-gemini-acceptance.md. Một số legacy text caller dùng fetch ngoài helper vẫn Gateway; không tuyên bố đã migrate mọi caller. Mẫu chất lượng thủ công giữ ý ở câu rõ; không che hạn chế từ ASR rời/nhầm từ. Sau restore chưa có segment mới ở lần quan sát cuối.
