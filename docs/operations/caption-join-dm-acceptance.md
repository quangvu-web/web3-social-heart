# Theo dõi nghiệm thu DM link phụ đề Zoom

Tất cả thời gian dưới đây là Malaysia UTC+8.

## Bằng chứng payload thật trước khi viết bộ trích xuất

Đã đọc log Edge Function angel-caption, nhãn `[angel-caption] join_payload_observed`:
- 24/10/2026 20:11:30: participant id100, is_host true, platform desktop.
- 24/10/2026 20:13:32: participant id200, is_host false, platform mobile_app.
- Cả hai thuộc cùng bot và caption session; `data.participant_events.id` giống nhau, đây là artifact chứ không phải webhook event ID.
- Đường dẫn thực: `data.data.participant.id` (number), `data.data.participant.name`, `data.data.action`, `data.bot.id`, `data.bot.metadata.caption_session_id`.
- Fixture đã loại tên/định danh Zoom tại `supabase/functions/angel-caption/fixtures/participant-join.json`. Raw payload vẫn nằm ở log backend; không đưa định danh thiết bị vào git.

## Kiểm chứng code

- Toàn bộ caption Edge suite:73 passed,0 failed (`deno test --no-check --no-lock --node-modules-dir=none --allow-read --allow-env supabase/functions/angel-caption`).
- Module DM + webhook:24 passed,0 failed với type-check.
- Frontend: `bun test src`,55 pass,0 fail.
- `deno check` toàn function:5 lỗi tồn tại cả ở origin/main, gồm3 FlagKey và2 kiểu kết quả output_media. Không gọi bước này là pass.
- Unique primary key webhook_id claim trước send; lỗi/timeout vẫn giữ claim. Không gửi everyone từ đường join.
- Bé xác nhận đã tạo bảng; kiểm tra chỉ đọc xác nhận bảng tồn tại, RLS true, service_role INSERT true, anon INSERT false. Agent không chạy migration.
- Lượt B vào lại sau khi bảng sẵn sàng:24/10/2026 20:26:11, participant300, log join_dm result sent; đúng1 claim `msg_3L8nsLTLeVrNoZpcg0GDxqyYCnN`.
- Lượt rejoin tiếp theo:24/10/2026 20:28:22, participant400, result sent; claim mới `msg_3L8o95UtnNgGguTG8sEesQJo3DD`. Zoom thay participant ID sau rejoin; chống trùng vẫn theo webhook-id, không khóa theo người.
- Bé xác nhận lần1 B thấy tin nhắn riêng từ Angel Translator; lần2 B nhận thêm đúng1 DM mới.
- Đối chiếu Zoom A sau cả hai lần gửi: tab Mọi người chỉ có1 tin từ Angel Translator lúc20:11, đúng link qat286tnm55e; không thấy DM mới trên A.

## Nghiệm thu thực tế bắt buộc

| Mục | Trạng thái | Bằng chứng còn cần |
|---|---|---|
| (a) A từ đầu, B sau5phút, DM đúng link, A không có tin mới | Log gửi riêng B lúc20:26; bé xác nhận nhận DM; A không có tin mới | Còn ảnh chat riêng B để lưu bằng chứng private và link đúng |
| (b) B rời/vào lại nhận đúng1 DM mới | Log sent20:28, webhook-id mới; bé xác nhận đúng1 DM mới | Còn ảnh DM B |
| (c) Bot không tự DM, không vòng lỗi | Đã tạo bot mới bằng bản DM lúc20:31: chỉ2 DM cho2 người thật100/200, không có self DM hay log lặp | Recall không phát event self trong mẫu thật; nhánh lọc tên self được kiểm thử riêng |
| (d) Public welcome vẫn đúng1 lần | Đạt trong phiên hiện tại: A vẫn có1 tin20:11 sau cả hai lượt B join; log có1 chat_announce sent và2 claimed_by_other | Đã đối chiếu UI A và log |

Phiên test quan sát: https://web3-social-heart.lovable.app/captions/qat286tnm55e . Bản quan sát không gửi DM nên không dùng các join cũ làm bằng chứng DM thành công.

## Kiểm tra bot mới trên bản DM đã deploy

- Sau hai lượt rejoin thành công, Angel dừng riêng phiên test cũ bằng /caption_stop và tạo phiên mới trong cùng phòng Zoom. Cuộc họp vẫn tiếp tục.
- Phiên mới `b5c6bzbr34j9`, session1764242e-a872-454c-a2f2-db6d0b2ae956, đã xác minh status live.
- 20:31:26 và20:31:27: join_dm sent cho2 người đang có mặt, participant100 và200. Không ghi nhận DM đến chính bot, không vòng lỗi.
- UI A có tab Angel Translator, nhãn “tin nhắn riêng tư”, đúng nội dung song ngữ và link b5c6bzbr34j9. Đây là kiểm chứng private delivery trên A, không thay cho ảnh B được yêu cầu.
- UI Mọi người có1 welcome cho phiên mới lúc20:31. Tin cũ20:11 thuộc phiên cũ đã đóng, không phải gửi trùng cùng phiên.
- Còn cần ảnh chat riêng B (phiên cũ hoặc mới, thấy rõ nhãn private và link) trước khi coi bộ bằng chứng nghiệm thu đầy đủ. Chưa merge main.
