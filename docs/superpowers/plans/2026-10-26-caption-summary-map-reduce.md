# Tóm tắt toàn phiên theo tầng

Spec: yêu cầu người dùng ngày 26/10/2026 (MYT), phiên đối chứng jc8aa6fq3z89: bản cũ chỉ đọc 24.000 ký tự đầu; bản mới phải bao phủ mọi chặng, nhất là 10 phút cuối.

- [x] Viết regression tests chạy thật summarizeSession với Gateway giả ở boundary: <=24.000 ký tự đúng một call, >24.000 chia toàn bộ dòng <=~8.000 ký tự không cắt ngang dòng; map notes giữ người nói/Q&A/thiền/thuyết trình/nhạc/nhảy/MC; reduce nhận mọi chunk theo thứ tự, lỗi chunk không gửi bản thiếu, log đúng số call.
- [x] Sửa summarizeSession: short path giữ prompt hiện tại; long path map với tối đa 3 worker, reduce một lần theo định dạng cũ; mỗi dòng vượt 8.000 ký tự được giữ riêng nguyên vẹn thay vì mất chữ. Không sửa Telegram formatter, routing nhóm/DM hoặc thời lượng.
- [x] Bỏ giới hạn lấy 1.000 dòng bằng phân trang có thứ tự seq/id trong runSummarize; kiểm thử không mất đuôi và lỗi trang sau không xuất bản tóm tắt thiếu.
- [ ] Đọc transcript thật jc8aa6fq3z89 qua public read API, lưu dữ liệu riêng ngoài repo; xác nhận coverage đầu/cuối và số chunk. Chạy live AI/re-summarize khi có runtime được triển khai và token nội bộ hợp lệ; không bypass auth hoặc lấy secret vào log.
- [ ] Chạy Edge suite, frontend bun test src, build; review diff độc lập, commit tiếng Việt, push và PR. Không tự merge hoặc chạy migration.

Giữ nguyên các hành vi khác. Chỉ log metadata/số call, không transcript/notes/secret. Số call trong log là callAiGateway logic; wrapper vẫn retry tối đa 2 lần theo cấu hình cũ. Test giả không phải nghiệm thu nội dung AI thật. Review focus: ngưỡng chính xác, newline/chunk boundary, dòng đơn quá dài, kết quả trống/truncated, map hoàn tất đảo thứ tự, lỗi đọc trang sau, không giả vờ pass nghiệm thu live.

Đã đọc dữ liệu thật: 600 dòng/61.867 ký tự/93,01 phút, production function dry-run forwards đủ qua 8 map+1 reduce. Raw transcript ngoài repo. Edge 87 pass; frontend59 pass; build thành công. Review độc lập không có findings. Root Bun67 lỗi nạp Deno tests và deno check5 lỗi baseline đã ghi trong acceptance. Production AI, gửi lại nhóm+DM và phiên mới >=60phút chưa thực hiện vì local không có runtime credentials. Không đánh dấu (a)/(b)/(c) production đạt từ mock.
