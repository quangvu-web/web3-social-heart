# Đọc ảnh khi được gọi trong nhóm — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

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

- [ ] Viết test admin boolean hợp lệ/không hợp lệ, group_id âm an toàn, không ghi sang nhóm khác; chạy RED.
- [ ] Thêm field được phép lưu + validation; thêm Switch có label theo yêu cầu, null/undefined hiển thị bật.
- [ ] Viết migration chỉ ADD COLUMN, không UPDATE nhóm. Chạy test GREEN, bun test/build.
- [ ] Push migration để bé áp dụng qua backend theo AGENTS.md mục 5; không tự chạy.

### Task 2: Vision nhóm và cache

**Files:** telegram-community-webhook/index.ts, _shared/telegram-community.ts, test group vision và helper/cache.

- [ ] Viết RED tests cho ảnh hiện tại, ảnh reply, thứ tự ưu tiên, explicit triggers (kể cả admin), không tag/auto trigger, off/null/settings lỗi, language en, duplicate/rate gates và ảnh khác cùng caption.
- [ ] Chọn nguồn ảnh sau trigger guard; đọc gate đúng nhóm, không dùng settings toàn cục. Vision sau lock/rate; bỏ cache text cho explicit photo; không để event-followup trả lời thay ảnh.
- [ ] Khi có mô tả dùng buildImageAnalysisContext(description, prompt) + imageAnalysisContext, giữ Telegram speaker context và language policy. Null → lời báo trung thực; group off → text như cũ. Chỉnh sửa ảnh rõ ràng giữ đường attachment độc lập tương tự DM.
- [ ] Mở persistent helper cache private/group/supergroup theo chat id; cùng key/TTL/memory/inflight. Test new worker/group scope/cross-chat, chạy GREEN và DM/language regression.

### Task 3: Nghiệm thu và tích hợp

- [ ] Review độc lập, xử lý lỗi quan trọng; git diff/check, commit tiếng Việt, push branch.
- [ ] Sau khi bé áp dụng migration: deploy admin/webhook và mở preview admin kiểm tra switch lưu qua reload.
- [ ] Nhóm test -1001649798056: ảnh có mention, reply ảnh, ảnh không mention (log không vision), tắt/bật switch, cache_hit khi gửi lại.
- [ ] LoveHub Africa -1003646058428 giữ reply_language=en; ảnh mention trả tiếng Anh.
- [ ] Lưu ảnh/bằng chứng và báo kết quả từng ca; chỉ merge sau preview đạt, theo ủy quyền hiện có.

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
