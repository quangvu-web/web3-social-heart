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

Đã triển khai code `5b992b2` lên riêng angel-caption version33, ACTIVE, không migration. Nghiệm thu ngày26/10/2026 (MYT):

- 22:27:35: lượt jc đầu failed sau8 call map do Gateway429; không reduce/gửi bản thiếu. Không coi lượt này đạt.
- 22:29:04: short4at49yfkkbxw,2 dòng/430 ký tự,1 call,body919 ký tự, completed. DM266700 và nhóm514478 đều nhận đúng MỘT tin, đủ bốn mục/song ngữ/bullet; header bold thật, heading ngắn vẫn do model như cũ. Footer📣 chỉ ở DM. Đã mở nhóm thực tế, không chỉ dựa vào footer.
- Lượt jc thử lại lúc22:29:45:8 chunk/9 call,body3.838 ký tự,completed. nhóm514479–514480 và DM266703–266704 đã nhận ĐÚNG HAI tin theo thứ tự. Cả hai nơi có nhãn phần1/2,2/2; mục1–2 ở phần1, mục3–4 ở phần2. Đã đọc cả nhóm và DM; nội dung khớp chính xác sau bỏ timestamp UI và footer DM. Nhóm dài3.158/860 ký tự hiển thị; DM3.158/904 ký tự tính cả footer. Tất cả dưới3.800. Bold thật3/6 thẻ theo phần, emoji/bullet còn đủ.
- Body3.838 ký tự, tăng30,8% so với bản cũ2.934 ký tự, đầy đặn hơn: nêu rõ thêm trust/greed/hypocrisy và stewardship; LoveHub/Thought Adjuster; thiền và khẳng định; MC đọc lời chúc và tương tác; trẻ em nghe Let love shine/cộng đồng nhảy; Q&A Simon Peter/Jesus có câu trả lời dài và đầy đủ hơn. Vẫn song ngữ từng nhóm, không đổi sang English-only. Không tự chèn nội dung nghiệm thu vào output.
- Cảnh báo📣/⚠️: nhóm không có; DM phần1 không có, phần2 có đúng một📣 ở cuối. Unit tests đối chiếu nối lại nguyên chuỗi trước/sau tách, kiểm chứng không mất mục/bullet/câu/entity. Các mục thật nằm nguyên trong đúng phần.
- (d) Giả lập bằng production delivery + Telegram boundary giả: lỗi HTTP403 ở phần cuối nhóm và throw ở phần đầu nhóm đều vẫn gửi đủ các phần nhóm còn lại/DM, chỉ một⚠️ ở DM cuối. Không giả lập lỗi bằng thay token/quyền/config nhóm production.

Giới hạn chất lượng AI vẫn còn: có lặp vài ý giữa main_points và nhóm hoạt động; nội dung giá trị có thể tự thêm dấu gạch ngang bên trong bullet. Formatter giữ nguyên theo yêu cầu, không sửa prompt short hoặc tự viết lại nội dung để che các điểm này.
