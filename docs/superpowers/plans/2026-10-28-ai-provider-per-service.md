# Tách AI Provider theo dịch vụ

**Goal:** Mỗi dịch vụ đúng một cờ: caption-translate → ai.provider.caption; describeImage → ai.provider.vision; ocr → ai.provider.ocr. Không còn cờ tổng điều khiển ba dịch vụ.

**Spec:** Yêu cầu chủ dự án ngày 28/10/2026 (MYT), base fbe11f5.

**Architecture:** Giữ helper/model/map/gates/retry/cache hiện có. Resolver chọn đúng key theo label; thiếu row có audit, đọc lỗi hoặc giá trị không hợp lệ về lovable. Không dùng cờ legacy hoặc env AI_PROVIDER làm override. Ba trạng thái UI và revision/saving guards độc lập theo key, dùng chung một lần tải danh sách và đọc lại đúng row sau từng lần ghi.

## Thứ tự bắt buộc

- [x] Chuẩn bị migration mới: khóa row nguồn trong transaction, copy nguyên enabled/meta live sang ba key, ON CONFLICT DO NOTHING; không thay row cũ, schema, RLS hoặc grants của table hiện có.
- [x] Chủ dự án nhờ Angel trong Lovable chạy migration trước deploy code. Codex không chạy migration theo AGENTS.md. Lưu snapshot nguồn và kết quả ba row để đối chiếu; nếu row đích đã tồn tại, ghi rõ giữ nguyên chứ không giả vờ bằng nguồn.
- [x] Regression RED→GREEN cho resolver/gateway: bật/tắt từng key; không đọc legacy; thiếu row cảnh báo cả khi cache hit; DB lỗi không dùng env override; nhãn ngoài phạm vi không query;429 chỉ fallback đúng call; giữ gates ảnh/stream và OCR empty.
- [x] Tách UI thành ba hàng, trạng thái/timestamp/loading/error/saving riêng; không để load cũ ghi đè save mới; upsert đúng key, select riêng, success chỉ khi DB khớp. Ẩn bốn key khỏi danh sách chung. Tests dùng React thực, DB boundary fixture.
- [x] Chạy bun test src, build, provider/vision/OCR Deno tests; review độc lập; commit tiếng Việt và push branch, không merge main.
- [x] Sau migration được xác nhận mới deploy/test live: phiên caption thật, ảnh DM, helper OCR runtime; thay từng cờ, xem log từng label,429 và legacy ineffective; restore chính xác enabled/meta trước test, dọn probes.

## Ràng buộc

Không đổi models, map, prompt, timeout/retry, caches, OCR conditions, chat/FUN Core, group-vision, transcript, auth/roles/RLS. Không migration tự chạy, không thêm override hoặc cờ tổng. Nếu migration chưa chạy, giữ branch chưa deploy; ghi rõ nghiệm thu live đang chờ thay vì dùng fixture thay chứng cứ production.

## Kết quả hiện tại

Migration do bé chạy, dữ liệu đã đối chiếu trước deploy; backend helper mới đã deploy và runtime probe chín stage + DM ảnh pass. Phiên caption thật 6wj7cqbp38u9 đã nghiệm thu Gemini và rollback bằng log/segment thật. Restore cả ba về true/lovable, legacy row nguyên vẹn. Reload browser UI mới với DB thật còn chờ; không dùng fixture thay nghiệm thu đó. Xem `docs/operations/ai-provider-per-service-acceptance.md`.
