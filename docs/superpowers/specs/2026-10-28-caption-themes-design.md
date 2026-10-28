# Giao diện trang phụ đề

Theo đặc tả chủ dự án: giữ Tối mặc định, thêm Sáng/Giấy ấm/Trung tính/Năng lượng/Tương phản cao. Toàn bộ màu trang dùng token caption trong index.css, scope bằng data-caption-theme, không đổi theme của FUN Profile. Bốn token caption mặc định giữ nguyên.

Angel chọn popover có 6 ô xem trước (nền + câu gốc/câu dịch + tên), cạnh ngôn ngữ/cỡ chữ. Header cho phép xuống hàng; popover giới hạn theo viewport. Hiển thị cả sáu ô ngay trên header sẽ chiếm phần lớn màn hình điện thoại; select thuần không thể hiện đủ mẫu màu. Popover đang dùng trong repo đáp ứng cả hai yêu cầu.

Lựa chọn cập nhật React state tức thì; lưu caption-theme vào localStorage độc lập tài khoản/phiên. Giá trị không hợp lệ hoặc storage bị chặn về Tối và không làm trang lỗi. Chấm live luôn đỏ. Giữ native scroll, panel sáu dòng, partial, memo history và toàn bộ đường dữ liệu/realtime/polling. Không chỉnh Edge Function.
