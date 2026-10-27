# Sửa STT “đợi ơn” thành “đội ơn”

**Scope:** Yêu cầu chủ dự án ngày 28/10/2026, base 7bea09b. Không sửa dịch, model/provider, UI, keyterms/cặp sửa cũ hoặc schema.

- [x] Viết test RED cho câu “cha dạ đợi ơn cha”, lặp nhiều lần, viết hoa đầu câu, chuỗi đúng và câu không liên quan; giữ bốn test cặp cũ. Test payload STT dựng từ KEYTERMS thật phải chứa “đội ơn” và giữ toàn bộ term cũ.
- [x] Thêm literal string replacements vào HEARING_CORRECTIONS (không dùng ASCII word boundary); thêm đúng một KEYTERMS mới. Chạy hồi quy caption.
- [x] Review diff, deploy angel-caption; không restart phiên đang live. Keyterms chỉ gửi khi khởi tạo bot/STT mới; lưới sửa transcript áp dụng ngay cho webhook sau deploy.
- [x] Probe có xác thực/thời hạn chỉ đọc/sửa caption_lines của session 6wj7cqbp38u9. Chụp snapshot các row có cụm sai trong text_source; CAS từng row, chỉ PATCH text_source và text_vi nếu có cụm sai, không sửa text_en/seq/dedupe_key/created_at. Đọc lại riêng, so metadata bất biến, liệt kê count/seq, query còn 0 cụm sai.
- [ ] Quan sát lần xuất hiện thật tiếp theo sau deploy, kiểm tra DB ghi “đội ơn” và English giữ nghĩa cảm ơn. Không tạo segment/webhook giả để nghiệm thu.
- [ ] Ghi bằng chứng tối thiểu, dọn probe/token, commit tiếng Việt và push branch riêng. Không tự chạy migration hoặc merge main.
