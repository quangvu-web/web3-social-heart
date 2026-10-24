# Đọc ảnh khi được gọi trong nhóm — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Cho phép bot hiểu ảnh hiện tại hoặc ảnh được reply khi được mention/reply-to-bot/ask, với công tắc riêng từng nhóm.

**Architecture:** Tái dùng helper vision của PR #27. Chọn ảnh hiện tại trước ảnh reply, gate bằng lời gọi trực tiếp và cài đặt tươi của đúng nhóm; thực hiện sau lock/rate gate. Truyền context ảnh xuyên suốt router và giữ luật ngôn ngữ nhóm. Mở persistent cache hiện có sang scope nhóm, không thay schema cache.

**Tech Stack:** React 18, TypeScript, Tailwind, Deno Edge Functions, Lovable Cloud; bun cho frontend.

**Spec:** Yêu cầu chủ dự án trong cuộc hội thoại ngày 25/10/2026, sáu mục triển khai và nghiệm thu (a)–(f).

## Global Constraints

- Giữ nguyên DM PR #27, OCR moderation, cờ chi phí toàn cục, reply_language và lệnh hiện có.
- Chỉ gọi vision với mention/reply-to-bot/ask thực sự được phép; không gọi với owner/admin tự động, help intent, positive engagement hay ảnh không gọi bot.
- Không tự chạy migration; chỉ chuẩn bị ALTER thêm group_vision_enabled BOOLEAN DEFAULT true. Không sửa generated types, auth/RLS hay migration đã apply.
- Bảo toàn patch MCP có sẵn; branch feature/group-image-vision.

## Review Focus

- Owner/admin có tag bot vẫn được đọc ảnh dù trigger được ghi là owner/admin.
- Reply photo thiếu chat metadata phải cache theo chat hiện tại; không chia sẻ giữa DM/nhóm khác.
- Caption giống nhau nhưng ảnh khác phải bỏ qua cache câu trả lời dạng chữ.
- Cờ nhóm tắt hoặc đọc cài đặt thất bại: không tải ảnh/forward attachment để lách gate.
- Null vision không để AI bịa; lời báo lỗi theo botVoiceBucket; context ảnh và English policy cùng sống qua strict mirror/retry.

### Task 1: Cài đặt nhóm và UI

**Files:** migration mới, telegram-community-admin/index.ts, TelegramGroupPanel.tsx, CommunitySettings.

- [x] Viết test admin boolean hợp lệ/không hợp lệ, group_id âm an toàn, không ghi sang nhóm khác; chạy RED.
- [x] Thêm field được phép lưu + validation; thêm Switch có label theo yêu cầu, null/undefined hiển thị bật.
- [x] Viết migration chỉ ADD COLUMN, không UPDATE nhóm. Chạy test GREEN, bun test/build.
- [x] Push migration để bé áp dụng qua backend theo AGENTS.md mục 5; không tự chạy.

### Task 2: Vision nhóm và cache

**Files:** telegram-community-webhook/index.ts, _shared/telegram-community.ts, test group vision và helper/cache.

- [x] Viết RED tests cho ảnh hiện tại, ảnh reply, thứ tự ưu tiên, explicit triggers (kể cả admin), không tag/auto trigger, off/null/settings lỗi, language en, duplicate/rate gates và ảnh khác cùng caption.
- [x] Chọn nguồn ảnh sau trigger guard; đọc gate đúng nhóm, không dùng settings toàn cục. Vision sau lock/rate; bỏ cache text cho explicit photo; không để event-followup trả lời thay ảnh.
- [x] Khi có mô tả dùng buildImageAnalysisContext(description, prompt) + imageAnalysisContext, giữ Telegram speaker context và language policy. Null → lời báo trung thực; group off → text như cũ. Chỉnh sửa ảnh rõ ràng giữ đường attachment độc lập tương tự DM.
- [x] Mở persistent helper cache private/group/supergroup theo chat id; cùng key/TTL/memory/inflight. Test new worker/group scope/cross-chat, chạy GREEN và DM/language regression.

### Task 3: Nghiệm thu và tích hợp

- [x] Review độc lập, xử lý lỗi quan trọng; git diff/check, commit tiếng Việt, push branch.
- [x] Sau khi bé áp dụng migration: deploy admin/webhook và mở preview admin kiểm tra switch lưu qua reload.
- [x] Nhóm test -1001649798056: ảnh có mention, reply ảnh, ảnh không mention (log không vision), tắt/bật switch, cache_hit khi gửi lại.
- [x] LoveHub Africa -1003646058428 giữ reply_language=en; ảnh mention trả tiếng Anh.
- [ ] Lưu ảnh/bằng chứng và báo kết quả từng ca; chỉ merge sau kiểm tra giao diện, theo ủy quyền hiện có.

## Ledger

- Ruling: gate dựa trên mentionTrigger/replyToBotTrigger/askTrigger, không chỉ triggerSource — owner/admin priority không được làm mất lời gọi trực tiếp.
- Ruling: đọc cài đặt nhóm lỗi/missing thì bỏ vision, tiếp tục text như cũ — không đoán quyền tiêu credit từ settings toàn cục.
- Ruling: bỏ answer cache cho các câu hỏi có nguồn photo trực tiếp — caption không định danh được ảnh; mô tả vẫn dùng cache vision 30 phút.

## Kết quả trước nghiệm thu

- RED: 6 test admin/handler thất bại trước triển khai; group persistent cache test thất bại đúng vì worker mới không hit.
- GREEN: 11 test admin/handler/helper mới đạt; hồi quy mở rộng 38 pass. Thêm kiểm thử actual askAngel cho ảnh reply + English policy + strict mirror đạt (2/2 transport).
- Frontend `bun test src`: 58 pass. `bunx --no-install vite build`: thành công.
- `deno check` vẫn đúng 8 lỗi baseline đã ghi ở PR #27 (3 FlagKey, 5 npm/esm.sh client); không có lỗi mới.
- Review độc lập: không có lỗi quan trọng; kiểm tra trigger/cờ/cache/ngôn ngữ/reply context/edit/migration.
- Bé xác nhận “Đã thêm cột” trong cuộc hội thoại; agent không chạy migration. Từ thời điểm này không sửa migration đã apply.

## Nghiệm thu thực tế — 25/10/2026, MYT (UTC+8)

- Backend admin/webhook đã deploy thành công. Lovable đã đồng bộ nhánh feature/group-image-vision; preview ban đầu báo chưa build, sau publish đã tải ứng dụng và giữ auth guard. Kiểm tra công tắc trên trang /admin đang đăng nhập của bản mới.
- (a) Nhóm test -1001649798056, ảnh mẫu không ghi giờ trong caption, tin 514079: log 03:13:55 model_success. Bot trả lời đúng19:00 MYT và FUN Profile trong ảnh (03:14).
- (b) Tin 514090 chỉ có chữ và tag bot, reply ảnh Thu Ha; helper xử lý ảnh gốc 514044 (03:23:20 model_success). Bot mô tả bố cục, sofa, thành viên và chữ LOVEHUB HAPPY; giữ đúng tác giả Thu Ha (03:23).
- (c) Ảnh không caption/tag 514087 khi cờ đã bật lại: log moderation03:20:38 kept/no_scam_continue/admin_anti_spam_exemption; không có telegram-vision cho tin này. Không thay logic OCR.
- (d) Switch nhóm test: tắt thành công, tải lại rồi chọn đúng nhóm vẫn tắt. Ảnh mention514084 có log03:18:56 group_disabled; không gọi helper/forward raw photo. Bật lại thành công; ảnh514088 được đọc bình thường. Khôi phục trạng thái bật ban đầu.
- (e) Gửi lại cùng ảnh514088: log03:21:03 cache_hit/persistent; bot chép đúng ba dòng chữ, không gọi lại model vision.
- (f) LoveHub Africa -1003646058428: UI vẫn Luôn tiếng Anh, vision bật; không ghi đổi settings nhóm này. Ảnh kèm caption tiếng Việt3162 có log03:25:38 model_success, chứng minh cache không lấy chéo nhóm. Bot trả lời toàn bộ bằng tiếng Anh, đúng FUN Profile/Community of Love and Connection/19:00 MYT (03:25).
- Ảnh bằng chứng cục bộ (không commit lịch sử chat): /tmp/group-image-vision-evidence/reply-photo.jpg, africa-english.jpg, africa-settings.jpg.
- Lượt hồi quy cuối: Edge39pass/0fail; frontend58pass/0fail; Vite build thành công. Không sửa migration sau khi bé xác nhận đã apply.
