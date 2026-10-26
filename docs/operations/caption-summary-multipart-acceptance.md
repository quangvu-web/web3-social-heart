# Nghiệm thu tóm tắt song ngữ nhiều tin

Ngày26/10/2026, Malaysia Time (UTC+8). Branch `feature/caption-summary-multipart`. Giữ bản song ngữ chung trong summary.vi; không đổi formatter, đích nhóm/fallback, thời lượng/link hoặc migration.

## Thay đổi

- Phiên dài: mục tiêu merge3200–4200 ký tự giá trị JSON, khoảng15–25 từ/150–200 ký tự mỗi ngôn ngữ/trường; body sau renderer tối đa7000. Không nén/cắt để vừa một tin.
- Body gửi đã format HTML: <=3800 ký tự hiển thị vẫn nguyên một tin. Khi dài, ưu tiên ranh giới trước Q&A thành mục1–2 /3–4 nếu vừa; nếu một mục quá dài, chỉ chia theo bullet nguyên khối, bao gồm các dòng tiếp nối. Mọi phần có nhãn phần N/M.
- Multipart dự phòng nhãn và tối đa245 ký tự trạng thái DM; mục tiêu mỗi phần<=3800 ký tự hiển thị. Short3800 + cảnh báo dài nhất vẫn dưới giới hạn Telegram4096. Đo độ dài sau bỏ thẻ b và giải mã entity escaped, UTF16 đếm bảo thủ emoji.
- Nhóm gửi tuần tự tất cả phần; một lỗi không ngăn các phần sau. DM luôn thử tuần tự đủ phần, trạng thái chỉ ở cuối, thành công chỉ khi mọi phần nhóm thành công. Một lỗi DM cũng không ngăn phần DM sau.
- Một bullet đơn vượt3530 ký tự khi cần multipart không bị cắt câu: splitter báo lỗi trước mọi gửi; log reason oversized_atomic_bullet. Đây là giới hạn khi không thể đồng thời giữ nguyên bullet và ngân sách mỗi phần, cần biên soạn lại nội dung nguồn/AI thay vì âm thầm truncate.

## Kiểm thử

- Edge:104 pass,0 fail, gồm regression coverage cũ và fixture600 dòng thật với Gateway giả. Các test mới kiểm chứng chia đúng mục, giữ đủ chuỗi/bullet/continuation/entity/emoji/bold, short3800 một tin, bullet3500 vẫn gửi được, lỗi nhóm HTTP/throw ở các phần và lỗi DM không mất phần sau, trạng thái chỉ cuối, chấp nhận body>3500 và từ chối>7000 không thêm AI call.
- Frontend `bun test src`:59 pass,0 fail. `bun run build`: thành công, file version tự sinh đã restore.
- Bare `bun test`:62 pass,68 fail/error do Bun không nạp các Deno npm: imports/globals, thêm file test Deno mới; không gọi toàn repo pass.
- `deno check` entrypoint:5 lỗi baseline như báo cáo map-reduce (3 FlagKey,2 Response playback); không sửa ngoài phạm vi.
- Review độc lập phát hiện hai lỗi splitter; đều có test tái hiện RED trước sửa: ưu tiên1–2/3–4 và bullet3500 bị reserve quá lớn. Đã sửa.

## Nghiệm thu thực tế

Chưa đánh dấu đạt từ mock. Sẽ deploy riêng angel-caption và chạy operator /caption_resend jc8aa6fq3z89 + phiên ngắn4at49yfkkbxw; đối chiếu bản nhóm và DM thật, số phần/thứ tự/nội dung/định dạng/trạng thái. Không giả lập lỗi bằng thay group config/token production; (d) dùng boundary test với Telegram giả gọi luồng delivery production thật.
