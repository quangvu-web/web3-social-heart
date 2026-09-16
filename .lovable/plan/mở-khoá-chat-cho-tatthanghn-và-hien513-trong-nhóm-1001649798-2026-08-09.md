# Mở khoá chat cho @tatthanghn và @hien513 trong nhóm -1001649798056

## Đã kiểm tra

- Không có bản ghi khoá nào của hai user này trong dữ liệu mute của bot (`telegram_group_mutes`) và cũng không có trạng thái cảnh cáo/mute nào ở nhóm `-1001649798056`.
- Log kiểm duyệt chỉ ghi nhận hoạt động ở một nhóm khác (`-1004482237625`): `hien513` từng bị xoá tin + cảnh cáo ngày 01/08, `Tatthanghn` chỉ có log xác minh thành viên bình thường.
- ID Telegram lấy được từ log: `@Tatthanghn` = 6268414796, `@hien513` = 8651207331.
- Ảnh chụp màn hình cho thấy dòng "The admins of this group have restricted your ability to send messages" — đây là **quyền mặc định của nhóm** do admin Telegram đặt, không phải do bot khoá.

Kết luận: bot không phải nguyên nhân. Muốn hai người này nói được trong nhóm đang bị hạn chế toàn cục, phải cấp quyền riêng cho từng user.

## Việc sẽ làm

1. Gọi Telegram `restrictChatMember` cho nhóm `-1001649798056` với hai user ID trên, bật đầy đủ quyền gửi tin (`can_send_messages`, `can_send_media_messages`, `can_send_other_messages`, `can_add_web_page_previews`, `until_date = 0`).
2. Đọc lại `getChatMember` cho từng user để xác nhận trạng thái là `restricted` nhưng `can_send_messages = true` (hoặc `member`), báo kết quả cụ thể.
3. Nếu Telegram trả lỗi (bot chưa có quyền "Ban users" trong nhóm đó, hoặc user chưa từng vào nhóm), báo lại chính xác lỗi và hướng dẫn admin cấp quyền cho bot.
4. Thêm nút "Mở khoá theo username/ID" trong tab Telegram của Admin UI để lần sau tự làm được: nhập group ID + username hoặc user ID, gọi action mới `unmute_user` trong `telegram-community-admin`, có ghi log kiểm duyệt.

## Kỹ thuật

- Backend: thêm `action === "unmute_user"` vào `supabase/functions/telegram-community-admin/index.ts`, dùng hàm `unrestrictChatMember` đã có sẵn trong `_shared/telegram-community.ts`, đồng thời xoá bản ghi `telegram_group_mutes` và reset `muted_until` trong `telegram_community_user_state` nếu có.
- Frontend: bổ sung form nhỏ trong `src/components/admin/TelegramMutesTab.tsx`.
- Không đụng tới bot Telegram 2FA.
