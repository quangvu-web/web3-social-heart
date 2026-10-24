# Ngôn ngữ trả lời theo nhóm

Triển khai đúng đặc tả của chủ dự án: thêm auto/en/vi qua đường update_settings hiện có; không đổi dữ liệu, schema, DM hay nhánh tiếng Anh.

- [x] Viết test resolver tiếng Việt, dịch có ngôn ngữ đích khác và hồi quy auto/en; chạy RED bằng Deno.
- [x] Viết test HTTP update_settings cho ba giá trị, đầu vào không hợp lệ, group_id sai và giữ cấu hình nhóm khác.
- [x] Thêm validation trước resolveSettings và whitelist reply_language; bổ sung nhánh vi đối xứng, giữ nguyên nhánh en.
- [x] Thêm Select tiếng Việt cạnh công tắc thông báo moderation, null hiển thị auto, lưu bằng updateSettings và khóa khi đang lưu.
- [ ] Chạy bun test src, Deno tests, build; review diff, commit tiếng Việt và push branch.
- [ ] Kiểm tra preview nếu có phiên admin; nghiệm thu Telegram cần nhóm test được xác định và quyền gửi tin. Không tự ghi dữ liệu production.

Review độc lập phát hiện cache chỉ phân biệt ngôn ngữ nội dung dịch, chưa phân biệt tiếng nói của bot. Thêm botVoiceBucket (hoặc auto) vào khóa cache để không dùng lại câu dẫn cũ sau khi đổi chính sách. Không sửa dữ liệu cache hay cấu hình nhóm.

Kết quả xác minh:
- Frontend: `bun test src` 55/55; `bunx vite build` thành công.
- Edge: `deno test --no-check --allow-env --allow-net` hai file group-reply-language_test.ts và reply-language_test.ts 9/9.
- Bộ Edge liên quan gồm telegram-community.test.ts: 55 qua, 1 lỗi detectMeditationInvite thiếu thành phần; đã tái hiện trên code HEAD gốc.
- `bun test` nền: 58 qua, 57 lỗi khi quét cả test Deno. Deno type-check nền: 3 lỗi FlagKey ngoài phạm vi.
- Chưa nghiệm thu thực tế: preview /admin chuyển sang /law-of-light; chưa có phiên admin. Lovable query_database trả database_not_managed nên chưa đọc được giá trị production LoveHub Africa. ID được cung cấp là -1003646058428 (LoveHub Africa); không ghi thay đổi vào nhóm này.

Deno check mở rộng của admin/webhook có 12 lỗi ngoài phần sửa, đã đối chiếu lại trên hai entrypoint HEAD gốc cũng 12 lỗi (FlagKey, kiểu kết quả Telegram, track-cloud-usage và kiểu client ở ingest). Test mới không còn lỗi type riêng. Review độc lập đã xác nhận sửa khóa cache giải quyết phát hiện, không còn vấn đề đáng kể trong phạm vi thay đổi.
