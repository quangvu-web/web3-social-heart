# Caption themes Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sáu giao diện đọc phụ đề, lựa chọn lưu theo thiết bị, Tối mặc định.

**Architecture:** Token scoped tại gốc trang và popover portal; React state lazy load từ localStorage; picker riêng với preview dùng cùng token thực tế.

**Tech Stack:** React 18, TypeScript, Tailwind 3, Radix Popover có sẵn, Bun tests.

**Spec:** ../specs/2026-10-28-caption-themes-design.md và đặc tả chủ dự án trong phiên.

## Global Constraints
- Giữ nguyên dữ liệu/realtime/polling/guest access; không đụng Edge Function.
- Giữ Tối mặc định, bốn token caption cũ, cỡ chữ 18–48 và ba chế độ ngôn ngữ.
- Màu chỉ nằm trong design token index.css; không thêm dependency.

## Review Focus
- localStorage thiếu/sai/bị chặn: trang vẫn đọc được, mặc định Tối.
- Portal thoát khỏi gốc trang: palette popup phải theo lựa chọn hiện hành.
- 320px và chữ 48px: controls wrap, lịch sử còn cuộn, panel giữ sáu dòng.
- Các mặt sáng và tương phản cao: câu dịch/partial/nút/tên người nói đủ tương phản.
- Theme đổi không gọi lại query/subscribe, không reset mode/cỡ chữ/cuộn.

## Task 1: Palette và chọn/lưu giao diện
- [x] RED: test lựa chọn hợp lệ, mặc định/sai/storage lỗi; test tương tác không reset đọc.
- [x] Thêm captionThemes.ts, CaptionThemePicker.tsx, token và Tailwind mapping.
- [x] Tích hợp CaptionsPage, đổi mọi màu hardcode sang token, giữ data path nguyên.
- [x] GREEN: bun test src, build và lint phạm vi.

## Task 2: Nghiệm thu và bàn giao
- [x] Browser: kiểm tra sáu palette bằng mắt, đổi tức thì/lưu/reload/phiên khác/mặc định, cỡ chữ và mobile; ghi rõ fixture khi dùng dữ liệu mẫu.
- [x] Review độc lập toàn diff, sửa phát hiện quan trọng, chạy kiểm tra cần thiết.
- [x] Ghi báo cáo/ảnh nếu khả thi, commit tiếng Việt, push branch riêng.

## Quyết định triển khai
- Yêu cầu đã chốt đầy đủ; Angel triển khai trực tiếp trong phiên, chọn popover sẵn có để vừa header mobile.

## Kết quả và review
- Frontend: 70/70 test; build Vite và lint phạm vi đạt. Bare bun test vẫn 70 lỗi khi nạp test Edge/Deno do runtime không tương thích; không sửa Edge trong đợt này.
- Browser local component thật với fixture backend: đủ sáu palette, partial, storage/reload/mã phiên khác/default, ±/18–48, 320px, jump về cuối đã kiểm tra.
- Review: chưa xác nhận lỗi chặn. Nghi vấn history collapse ở 320×568/font48 được đo thực tế còn34.44px; giữ panel sáu dòng theo yêu cầu. Trigger cố định độ rộng theo breakpoint và nhóm ± để giữ header ổn định. Accessible name có tên giao diện đang chọn.
