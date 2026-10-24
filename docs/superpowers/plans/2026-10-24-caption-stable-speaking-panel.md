# Khung đang nói ổn định

- CaptionsPage: vùng lịch sử riêng flex-1 min-h-0, nút dòng mới nhất neo trong vùng này. Partial không nằm trong vùng scrollRef.
- Khung live là sibling shrink-0, cao8.25em =6 dòng leading-snug1.375 theo fontSize. Luôn mount khi live; giữ nguyên các node tên/nội dung khi chuyển partial/chờ. overflow-y-auto overscroll-contain.
- Effect tự cuộn chỉ phụ thuộc lines; giữ ngưỡng160px, cờ bám đáy, đếm dòng chưa đọc và nút jump. Không sửa polling/Realtime hay nội dung nguồn/dịch.
- Test hồi quy render/effect: partial mới/cũ/biến mất không thay deps/history; final mới vẫn auto-scroll khi bám đáy, không kéo người đọc lịch sử; khung cố định theo font.
- Kiểm tra trình duyệt desktop/mobile bằng fixture cục bộ có partial theo từng từ, khoảng chờ15giây, câu dài và final; theo dõi60giây. Đối chiếu phiên yjf6gn42bxcz nếu còn dữ liệu live. Không sửa dữ liệu backend để test UI.
- bun test src, bun run build; review, commit tiếng Việt, push nhánh, preview trước main. Bảo toàn MCP patch.
