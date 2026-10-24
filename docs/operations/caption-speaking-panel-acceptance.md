# Nghiệm thu khung đang nói cố định

Phạm vi: CaptionsPage, không thay đổi dữ liệu hay Edge Function. Fixture trình duyệt dùng đúng component và CSS của repo, backend mô phỏng ngoài repo; dữ liệu phiên thật chỉ được đọc.

## Kết quả

| Mục | Bằng chứng |
|---|---|
| (a) Theo dõi60giây | Desktop và viewport mobile390×844 chạy chuỗi60giây, partial cập nhật mỗi500ms. ScrollTop chỉ thay khi thêm final ở15/45/60giây. Desktop:2542→2668→2793.5→2919.5; mobile:6268→6539.5→6810.5→7082. |
| (b) Xuất hiện / hết hạn / câu mới | Trong cùng lượt, dừng partial ở20giây, thấy placeholder sau15giây, câu mới bắt đầu38giây. Khung luôn231px, chiều cao lịch sử và trang không đổi. |
| (c) Dài hơn6dòng | Mobile nội dung dài có scrollHeight9687px trong clientHeight230px; scrollTop nội bộ đạt9457.5px. ScrollTop trang vẫn0, lịch sử7353.5 không đổi khi cuộn vượt đáy khung. |
| (d) Đọc lùi / nút dòng mới | Desktop đọc lùi top1709.5 không đổi khi partial/câu chốt mới; mobile top6045.5 cũng không đổi. Nút1dòng mới vẫn hiện, nằm trên khung; click đưa về cuối lịch sử. |
| (e) Desktop / điện thoại | Đã kiểm tra cả kích thước desktop tự nhiên và mobile390×844. Khung28px =231px; nút tăng lên32px cho chiều cao264px. Viewport override đã được reset. |

## Đối chiếu phiên yjf6gn42bxcz

Mở phiên live trên bản frontend local đã sửa, giữ nguyên backend thật. Có trên600dòng lịch sử. Trong các mẫu liên tiếp cùng611finals, partial tăng10→41→67→87ký tự, history scrollTop luôn86614; khung231px, đỉnh608px, trang cao839px không đổi. Các mẫu có final mới thì lịch sử cuộn như trước. Phiên thật bổ sung kiểm chứng Realtime/polling; chuỗi hết hạn/câu rất dài được kiểm tra có kiểm soát bằng fixture, không ghi dữ liệu giả vào backend.

## Kiểm tra tự động

- bun test src:58 pass,0 fail.
- CaptionsPage.test.ts:10 pass, gồm kiểm tra effect, bám đáy/jump và cấu trúc cố định fresh/stale/missing partial.
- bun run build:thành công. Các file version được build tự sinh đã khôi phục về trạng thái ban đầu.
- Review độc lập:không có lỗi Critical/Important; đã bổ sung ca expiry của partial có nội dung và so sánh cấu trúc stale theo góp ý.

Giữ nguyên ngưỡng160px, mode Tiếng Việt/English/Song ngữ, cỡ chữ, nguồn+dịch, polling và Realtime. Không thay đổi MCP patch có sẵn.
