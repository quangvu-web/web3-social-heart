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
- Bảng claim chưa tồn tại khi kiểm tra Table Editor. Agent không chạy migration theo AGENTS.md mục5.

## Nghiệm thu thực tế bắt buộc

| Mục | Trạng thái | Bằng chứng còn cần |
|---|---|---|
| (a) A từ đầu, B sau5phút, DM đúng link, A không có tin mới | Chưa chạy bản DM | Ảnh chat riêng B và đối chiếu chat A |
| (b) B rời/vào lại nhận đúng1 DM mới | Chưa chạy | Log2 webhook-id khác nhau, ảnh DM B |
| (c) Bot không tự DM, không vòng lỗi | Unit tests đạt; live chưa xác minh | Log self_bot_skipped nếu Recall phát self join; đối chiếu danh sách DM |
| (d) Public welcome vẫn đúng1 lần | Test hồi quy hiện có đạt; live chưa xác minh | Chat công khai của A, log chat_announce |

Phiên test quan sát: https://web3-social-heart.lovable.app/captions/qat286tnm55e . Bản quan sát không gửi DM nên không dùng các join cũ làm bằng chứng DM thành công.
