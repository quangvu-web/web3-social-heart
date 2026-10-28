# Sửa lỗi nghe trong bài cảm ơn của Angel Kim

**Base:** 08740a1; branch fix/caption-meditation-hearing. Đặc tả chủ dự án ngày 28/10/2026 là phạm vi duyệt. Angel dùng TDD và review độc lập như đợt trước.

- [x] Kiểm tra workspace sạch, xác định đúng phiên qua mã/UUID prefix; chỉ đọc dữ liệu trước sửa.
- [x] Test RED từng literal mới, giữ cặp cũ; payload KEYTERMS thật phải có đủ 10 term mới và giữ danh sách cũ.
- [x] Thêm đúng literal và keyterms; không thay model/provider/prompt/UI hoặc translator. Cụm thiền/thiên/tân chỉ thêm sau đối chiếu câu đúng và DB.
- [x] Deno typed targeted + toàn bộ caption, frontend hồi quy; review diff và probe CAS.
- [x] Deploy angel-caption; không restart phiên. KEYTERMS mới chỉ có ở bot/STT mới.
- [x] Sửa đúng phiên bằng CAS, PATCH chỉ text_source và text_vi khi chứa literal; GET riêng đối chiếu metadata/text_en; báo count, seq và remaining=0.
- [ ] Nghiệm thu live phiên thử do bé cung cấp, năm cụm đúng trong DB; không tạo webhook/transcript giả.
- [x] Lưu bằng chứng sửa dữ liệu tối thiểu và xóa probe/token.
- [ ] Commit tiếng Việt, push nhánh riêng; cập nhật nghiệm thu live khi đủ bằng chứng.

## Quyết định theo bằng chứng
- Lovable query_database không truy cập được DB (kể cả SELECT 1); dùng probe tạm có bearer hash và hạn 2 giờ, đúng một phiên, không schema/migration.
- UUID prefix 7a710178 ánh xạ duy nhất sang 7a710178-174b-4a25-a906-741ce720a466, public code k4e5yd55zfu5. Phiên đã ended ngày 25/10/2026; nghiệm thu mới cần phiên thử riêng.
- Seq461 chứa nguyên văn “thời thiên thập tân tấn”. Dùng cặp dài này → “thời thiền thật tinh tấn” theo câu chủ dự án cung cấp; không dùng “thập tân” ngắn vì tạo “tinh tấn tấn”. Không suy diễn các lỗi khác ngoài các literal được duyệt.
