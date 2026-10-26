# Tóm tắt song ngữ nhiều tin

Phương án do chủ dự án chốt trong yêu cầu: giữ song ngữ, nới merge target3200–4200 ký tự/max7000, tách tại mục trước và bullet sau. Angel thực hiện trực tiếp theo spec này.

- [x] Viết test splitter với bốn mục HTML đã format: tin ngắn nguyên vẹn, ưu tiên1–2/3–4, mục quá dài tách bullet, không mất/chẻ bullet, entity/emoji/bold nguyên vẹn. Bullet đơn quá giới hạn phải lỗi trước gửi, không truncate.
- [x] Thêm summary-parts.ts: tính độ dài hiển thị Telegram, chia section/bullet nguyên khối, nhãn phần có tổng số, dự trữ trạng thái cuối. Không sửa formatter.
- [x] Test delivery thật với Telegram giả tại boundary: nhóm và DM đúng thứ tự/đủ phần; lỗi hoặc throw ở một phần nhóm vẫn thử các phần còn lại và DM đủ, cảnh báo chỉ phần cuối; lỗi một phần DM không chặn phần sau. Giữ group target/fallback.
- [x] Nới prompt/budget7000, test chấp nhận bản >3500 và từ chối >7000 không thêm AI call. Không đổi short prompt/song ngữ/coverage.
- [x] Chạy Edge/frontend/build, review diff, commit/push PR riêng. Deploy riêng function và chạy lại jc + short qua operator hiện hành; đọc CẢ nhóm/DM, ghi bằng chứng hoặc blocker thật. Không migration, không tự merge.

Review: độ dài phải tính cả nhãn/status; HTML entity không bị chẻ; group partial failure không báo thành công; một bullet không thể chia không được cắt câu; nội dung đủ hai ngôn ngữ và các chặng còn giữ.

Kết quả:104 Edge/59 frontend pass; build thành công. Review sửa2 lỗi splitter có RED→GREEN. Deploy version33; jc nhóm514479–514480,DM266703–266704 nhận2 tin khớp nhau; short nhóm514478/DM266700 nhận1 tin. Chi tiết và lỗi Gateway429 lượt đầu trong báo cáo operations. PR31 đang draft, chưa merge.
