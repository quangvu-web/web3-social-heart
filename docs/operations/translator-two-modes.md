# Angel Translator — phụ đề trực tiếp và bản MC đọc lại

## Phạm vi nâng cấp

Hai chế độ ở cùng trang `/captions/:code`, mặc định **Phụ đề trực tiếp**. Chưa merge/deploy bản nâng cấp này. Không thay đổi auth bootstrap, Law of Light, RLS/schema, secrets, Recall/STT provider hoặc cấu hình turn silence. Không tạo function mới và không cần migration.

- **Phụ đề trực tiếp:** giữ bản tiếng Việt gốc, dịch trung thành từng câu final; văn nói tự nhiên, giữ ý nhấn mạnh và lặp có chủ ý. Không tự thêm lời dẫn, không đoán phần nói dở hoặc sửa lời chào/tên nghe sai bằng phỏng đoán. Realtime, polling, catch-up, phần đang nói và thứ tự dòng vẫn giữ luồng hiện có.
- **Bản MC đọc lại:** người dùng chủ động lấy/dán một đoạn Việt → tạo bản Việt biên tập → tự sửa và xác nhận đã rà soát → dịch đúng bản Việt đã rà soát sang Anh → chỉnh nhịp đọc/sao chép. Không tự chạy mỗi khi có phụ đề, không thay hoặc cập nhật ngược `caption_lines`/`caption_partials`, không gửi Telegram, không ghi hội thoại/memory.

## Cách dùng

1. Mở phiên phụ đề và chọn **Bản MC đọc lại**. Khách vẫn xem/soạn cục bộ được, nhưng tạo bằng AI cần đăng nhập FUN Profile. Link đăng nhập mở tab mới để tránh mất bản soạn hiện tại; sau đăng nhập quay lại và bấm tạo.
2. Dán lời nói tiếng Việt vào ô 1, hoặc bấm **Lấy đoạn tiếng Việt gần nhất**. Nút này chụp tối đa 6 dòng final Việt liên tiếp cuối cùng có cùng tên người nói, không quá 6.000 ký tự. Nếu không rõ tên người nói chỉ lấy 1 dòng. Không dùng bản dịch Việt của lời Anh hoặc trộn qua ranh giới người nói. Đây là một đoạn có báo số dòng, không phải toàn bộ cuộc họp; không cắt bớt một dòng để nhét giới hạn.
3. Bấm **Tạo bản Việt biên tập**. Angel sửa dấu câu, chia đoạn, bỏ tiếng đệm/lặp vô nghĩa, giữ mọi ý thực chất và giọng người nói. Không tự thêm lời cảm ơn/kết luận/“chúng ta bắt đầu” nếu nguồn không có. Phần không rõ được giữ dưới dạng `[chưa rõ: nguyên văn]`; bé đối chiếu âm thanh và sửa, không để AI đoán tên.
4. Đọc/sửa ô 2; xác nhận tên, số, ý nghĩa và cách gọi. Còn dấu `[chưa rõ: ...]` hoặc chưa xác nhận thì nút dịch Anh khóa. Có thể tự biên tập/dán bản Việt vào ô 2 mà không dùng AI ở bước Việt.
5. Bấm **Dịch bản Việt đã rà soát sang Anh**. Câu Anh dùng từ thông dụng, đoạn ngắn, giọng ấm áp để đọc trước khán giả; giữ góc nhìn của người nói. “bé + tên” không tự thành baby/little one; Cha Vũ Trụ → Father Universe, Cha tâm linh → Father; Thầy với vai trò danh xưng → our Teacher. Không mặc định đoán tuổi/giới tính; giữ nghĩa gia đình khi ngữ cảnh nêu rõ.
6. Bản Anh có thể sửa trực tiếp và sao chép; cỡ chữ theo nút +/− trên trang. Sửa bản Việt hoặc lời gốc sẽ làm bản Anh cũ bị xóa để không dùng nhầm. Nếu nguồn đổi, bản Việt cũ vẫn giữ để bé đối chiếu nhưng cần biên tập lại/chỉnh khớp nguồn rồi xác nhận lại.

Bản soạn chỉ ở state của trang, không localStorage/database. Chuyển giữa hai tab chế độ không xóa bản soạn; phiên khác, tải lại hoặc đóng trang sẽ mất. Nội dung Realtime mới không tự điền hay ghi đè ô đang soạn. Lỗi AI giữ nguyên bản đang có; hủy request khi component unmount. Văn bản dán quá dài được giữ nguyên và khóa tạo, không âm thầm cắt mất ý.

## API, giới hạn và quyền

Function hiện có `angel-caption?action=mc-script`, chỉ POST với JWT người dùng được `auth.getUser()` xác minh. Không dùng `CAPTION_INTERNAL_TOKEN` cho giao diện, không tin guest/user ID do client khai báo. Không sửa luồng auth của chat/phiên phụ đề hiện có.

- Body `{ stage: "edit-vi" | "translate-en", text: string }`; 20–6.000 ký tự sau kiểm tra; body stream tối đa 32 KiB. Server không tự lấy session/phụ đề riêng hoặc dữ liệu người khác.
- Dùng RPC atomic `check_rate_limit` sẵn có: khóa namespace riêng `caption-mc`, 3 request/phút, 30 request/24 giờ, kiểm tra riêng theo user ID xác minh và IP hash. Đây là 30 bước tạo, không phải 30 cặp Việt–Anh. Mỗi lần thử hợp lệ tính quota kể cả provider lỗi; không tự hoàn quota. IP/DB thiếu hoặc quota lỗi thì không gọi AI. Không thay quota khách chat.
- Dùng cùng provider flag/model của `caption-translate`; prompt biệt lập, không FUN Core RAG, memory hoặc các quy tắc xưng hô của bot chat. Chỉ plain text, không JSON mode mới. Timeout 30 giây, tối đa một attempt/provider; gateway vẫn có thể fallback provider theo cơ chế sẵn có. MC gọi AI thêm khi người dùng bấm; không phát sinh gọi MC trên đường phụ đề trực tiếp.
- Chỉ chấp nhận `finish_reason=stop`, nội dung không rỗng; bản Việt tối đa 6.000 ký tự, Anh tối đa 12.000. Length/content_filter/tool_calls/malformed/lỗi provider đều trả lỗi, không hiển thị một câu bị cắt như bản hoàn chỉnh. Bản dài nên chia thành đoạn thay vì tự nối nhiều lượt có thể mất ý.
- Không log lời nói/JWT/provider body trong handler MC, không lưu bản MC trên backend. Bộ đếm và usage kỹ thuật hiện có vẫn hoạt động; dịch vụ AI được chọn vẫn nhận nội dung bé bấm tạo.

## Mẫu nghiệm thu từ bé

Nguồn mở đầu có đoạn nghe sai “Về coi kính cho cha Charlie…”: chưa có âm thanh nên không thể xác nhận người được chào. Bản MC không được tự biến câu đó thành “kính chào Cha Vũ Trụ, kính chào Charlie” bằng cách đoán. Bé cần sửa nguồn hoặc marker trước bước Anh.

Đối với các ý rõ “mọi việc Cha đã hoàn thành… không phải lời hứa… đã chuẩn bị sẵn sàng… bạn chỉ cần ở đây”, nghiệm thu cần giữ chủ đề/ý nhấn mạnh đó và diễn đạt Anh tự nhiên như “Everything has already been accomplished. Everything is ready.” Không thêm lời cảm ơn hay “let’s begin” vì câu gốc mẫu không có. Đây là chuẩn biên tập do người cung cấp, không phải kết quả đã gọi model thật hoặc bảo đảm chất lượng tương đương ChatGPT.

## Triển khai và nghiệm thu live

Kiểm chứng local ngày 09/11/2026 (Malaysia): `bun test src` đạt 88 pass, 0 fail; bộ Deno `angel-caption` đạt 133 pass, 0 fail, 1 ignored; TypeScript, `deno check` entrypoint và `bun run build` thành công. Bài ignored cần phiên thật. Đã mở trang phụ đề local, chuyển hai chế độ, kiểm tra giữ draft và khóa dịch Anh trước khi rà soát. Chưa gọi model thật, chưa kiểm tra mobile và chưa triển khai API/giao diện mới lên live. Ảnh kiểm tra local: `/private/tmp/translator-two-modes-local-20261109.png`.

Review nhánh → merge → deploy lại `angel-caption` hiện có → Publish frontend sau khi được duyệt. Không migration, không đổi secret/config, không dừng phiên đang phát. Kiểm tra:

1. Khách vẫn xem phụ đề trực tiếp được; MC request chưa đăng nhập bị 401, không có AI call.
2. Đăng nhập thật, thử mẫu ở trên qua cả hai bước; sửa đoạn chào chưa rõ và duyệt Việt trước Anh. Đối chiếu số/ngôi/phủ định/tên và đọc Anh thành lời với người nghe.
3. Gửi quá quota, quota DB lỗi, response thiếu/chưa hoàn chỉnh: báo lỗi, giữ bản gốc; kiểm tra không phát nội dung ra Telegram.
4. Trong lúc soạn có dòng Realtime mới, đổi tab chế độ/theme/cỡ chữ: bản soạn không bị thay; trở về live vẫn nhận dòng mới. Phiên khác không giữ nhầm draft.
5. Chưa có âm thanh kiểm chứng nhận giọng; thay đổi này không cải tiến acoustic model hoặc tự khôi phục thông tin ASR đã nghe mất. Chưa nghiệm thu chất lượng ngôn ngữ nếu chỉ dựa test mock/prompt.
