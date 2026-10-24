# DM link phụ đề cho người vào Zoom muộn

Phạm vi: angel-caption; giữ nguyên tin chào everyone, transcript final/partial, đóng phiên và tóm tắt. Không sửa phiên bot đang chạy.

## 1. Ghi nhận payload thật trước
- Thêm participant_events.join vào buildRecallBotBody, giữ cả hai transcript events và các cấu hình fallback.
- Sau xác thực Svix, ghi nguyên payload join đầu tiên mỗi worker bằng nhãn join_payload_observed; không đọc participant hay gửi DM trong giai đoạn này.
- Test cấu hình và handler quan sát, chạy Deno rồi triển khai function để tạo phiên test mới.
- Ghi bằng chứng payload thật và các đường dẫn đã xác minh. Chưa có bằng chứng thì dừng phần trích xuất.

## 2. DM sau khi có bằng chứng
- Viết fixture từ payload thực đã loại thông tin cá nhân; dùng đường dẫn đã xác minh cho bot, metadata, participant ID và tên.
- Bỏ qua Angel Translator 🌐; chỉ phiên đang chạy, bot khớp phiên; không fallback gửi everyone khi thiếu ID.
- Claim bền vững, nguyên tử theo webhook-id trước gửi; giữ claim cả khi gửi lỗi. Không dùng bộ nhớ worker làm chống trùng.
- Nếu cần bảng riêng: chuẩn bị migration có RLS và GRANT service_role; để bé nhờ Lovable áp dụng, Angel không chạy migration.
- Gửi đúng nội dung song ngữ trong yêu cầu, to là ID dạng string. Một log join_dm gồm session_id, participant_id, result; lỗi chỉ cảnh báo và ACK 200.
- Test đồng thời/trùng, rejoin ID sự kiện mới, bot self, thiếu ID/header, phiên đã đóng, lỗi claim/Recall, giữ nguyên public welcome.

## 3. Nghiệm thu
- Deno tests riêng với bun test src; không gọi pass cho kiểm tra chưa chạy.
- A có mặt từ đầu; B vào sau 5 phút có DM đúng link; ảnh chat B chứng minh private, A không có tin mới.
- B rời/vào lại nhận đúng một DM mới; bot không tự DM; everyone chỉ một lần.
- Review diff, commit tiếng Việt, push nhánh; preview trước merge main. Bảo toàn MCP patch có sẵn.

## Trạng thái
- Đã deploy bản đăng ký join và ghi payload; bot test public code `qat286tnm55e`.
- Đã đọc hai raw join payload trong log backend lúc 24/10/2026 20:11:30 và 20:13:32 UTC+8 trước khi viết bộ trích xuất.
- Đã nối handler DM, loại log raw tạm, kiểm tra bot tự vào/phiên/bot identity, claim theo header Svix.
- Migration chưa áp dụng: Table Editor schema public tìm caption_join_dm_claims trả No results found.
- Edge Function suite 73 đạt với no-check; riêng module DM và webhook24 đạt với type-check. Frontend bun test src55 đạt.
- deno check toàn function có5 lỗi, đã đối chiếu origin/main cũng cùng5 lỗi; không phát sinh lỗi mới từ module DM.
- Chưa nghiệm thu Zoom(a)–(d), chưa có ảnh chat B, chưa merge main.
- Nguồn đối chiếu: https://docs.recall.ai/docs/sending-chat-messages và https://docs.recall.ai/docs/real-time-event-payloads . Tài liệu không thay thế payload thật.
