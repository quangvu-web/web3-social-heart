# Điều tra cảnh báo xóa tin moderation lặp — 2026-10-05 (UTC+8)

## Kết luận có bằng chứng

- `applyViolation` trước sửa gọi `deleteMessage` một lần sau bước cập nhật warning state. `callCommunityTelegram` chỉ thành công nếu HTTP thành công và payload `ok === true`; mạng lỗi/JSON không hợp lệ được trả về thất bại. Việc kiểm tra Telegram `ok` không phải lỗi đã chứng minh.
- Khi xóa thất bại và chưa ban/mute thành công, mỗi lượt gọi đều đăng nguyên cảnh báo tiếng Anh, không có khóa DB/cooldown. Nhánh ban/mute thành công nhưng xóa thất bại cũng đăng thông báo riêng từng lượt. Đây là nguyên nhân lặp đã chứng minh trong mã và fixture, chưa phải nguyên nhân Telegram từ chối xóa ở production.
- Nhánh escalation có cảnh báo lỗi riêng không được dedupe. Nhánh scam-protection dùng Map cho cảnh báo và có thể báo “đã bị xoá” khi `enforceScamDeletion` trả `delete_failed`.
- Log cũ của applyViolation giữ rule + `delete_failed:<code|unknown>`; không phân biệt lỗi mạng, body không hợp lệ và giới hạn xóa. Escalation không giữ detector ban đầu; automated CJK giữ chi tiết xóa trong message_text thay vì reason.

## Những điều chưa xác minh được ở group -1001649798056

Không có ảnh trực tiếp/thời điểm chụp trong phiên. Kết nối Lovable trả nhiều project FUN/remix nhưng chưa xác minh được project tương ứng backend của repo. Không đọc moderation metadata production, Edge logs hoặc nội dung/username; không gọi Telegram API production. Chưa xác minh quyền `can_delete_messages`, mã lỗi thực tế, từng message ID và detector/rule đã kích hoạt. Không kết luận thiếu quyền, giới hạn Telegram hoặc false positive từ ảnh.

## Truy dấu detector

Pipeline chạy scam protection trước anti-spam. Scam protection kết hợp detector QR/phishing/referral và risk assessment link/domain; không có bypass FUN/tâm linh chung ở đầu nhánh này.

Anti-spam chạy automated CJK trước exemption admin/bot/trusted sender và trước bypass FUN. Sau state/rate: bypass FUN/tâm linh trên text → preview Telegram → external bot → keyword DB → OCR (container rủi ro hoặc thành viên mới) → heuristic mention/CJK/abuse/carding/Latin → account shop → CJK chatter → suspicious TLD → rate limit. OCR có bypass FUN/tâm linh trên caption + OCR trước khi xét keyword/bot/link OCR.

Fixture mới hoàn toàn tổng hợp chứng minh một keyword riêng lẻ có thể trùng trong nội dung FUN hợp lệ, trong khi exemption hiện có vẫn nhận ra text/OCR. Đây là characterization test cho ngoại lệ hiện có, không phải false positive production đã được xác nhận. Không đổi keyword, detector, ngưỡng, whitelist hoặc chính sách ban/mute.

## Thay đổi local

- Chuẩn hóa kết quả xóa: `permission_denied`, `message_not_deletable`, `message_not_found`, `transport_error`, `invalid_response`, `telegram_error`, `configuration_unavailable`. Chỉ phân loại description theo mẫu đã cho phép, không lưu raw description trong log mới. Mã lỗi vẫn được giữ; chỉ mã 400/403 không đủ kết luận thiếu quyền.
- Nhánh kiểm tra quyền lỗi chỉ xuất `permission_check_unverified`, không chuyển raw Telegram description vào Edge log.
- Event Edge `TELEGRAM_MODERATION_DELETE` chỉ có group/message ID, kết quả, mã lỗi, nhóm lỗi; cùng metadata được thêm vào reason. Log mới của thông báo chỉ có group/message ID, action/reason. Bỏ detected_text và actor khỏi dòng log MODERATION đã sửa.
- Các cảnh báo lỗi xóa ở applyViolation, escalation và scam protection dùng chung RPC claim trước gửi. Ban thành công nhưng xóa thất bại vẫn ghi `banned_message_delete_failed`. Log moderation gốc luôn được ghi trước bước claim, từng lỗi vẫn hiện dù cảnh báo bị chặn.
- SQL đề xuất nằm ngoài `supabase/migrations/`: hai bảng metadata có RLS, quyền service_role và RPC chỉ service_role được thực thi. Unique (group,message) chặn retry; khóa row group + clock DB tạo rolling cooldown 5 phút cho mọi lỗi xóa cùng group. Key của cả tin đã gửi và tin bị cooldown đều được lưu.
- RPC thiếu/lỗi/kết quả lạ: không gửi, ghi `moderation_notice_unavailable`. Gửi thất bại/không xác minh: giữ claim, ghi `moderation_notice_send_failed`. Không âm thầm báo moderation thành công.

Giới hạn: bảo đảm tối đa một **lần thử gửi** cho mỗi tin, không bảo đảm exactly-once delivery Telegram. Crash sau claim có thể mất cảnh báo; log lỗi gốc vẫn còn và tin lỗi mới có thể cảnh báo sau cooldown. Key phải được giữ trong thời gian còn khả năng replay. Dedupe này chỉ cho thông báo, không thay cơ chế đếm warning/xóa/ban hiện có khi update xử lý lại. Map cooldown cho cảnh báo scam đã xóa thành công vẫn nằm ngoài phạm vi lỗi xóa.

## Kiểm thử

- `bun test src`: **39 pass, 0 fail** (frontend).
- `bun test` toàn repo: **42 pass, 29 fail/29 errors**, không pass; Bun quét test Deno và không resolve `npm:`/module Deno. Không dùng kết quả này để nói frontend hoặc Edge pass.
- `deno test --no-lock` với notice/outcome/transport: **11 pass, 0 fail**, có type-check.
- Test tích hợp applyViolation qua fetch/DB giả: **1 pass** với `--no-check --allow-env --allow-read`; tất cả fetch được chặn bằng fixture, không có quyền network. Kiểm tra permission/API limit/network/invalid JSON, action/reason và retry bị chặn.
- Test FUN text/OCR tổng hợp: **1 pass**, `--no-check`, không đổi detector.
- Coverage còn giới hạn: chưa chạy end-to-end webhook scam/escalation/CJK; integration kiểm tra applyViolation và RPC được mock, SQL concurrency được kiểm tra độc lập bằng kết nối thật. Nếu insert audit gốc thất bại, metadata Edge vẫn còn nhưng row tương ứng trong Telegram Operations có thể thiếu.
- Test PostgreSQL tạm qua Unix socket: **1 pass**, SQL chỉ áp dụng fixture local. Nhiều kết nối thật kiểm tra concurrency, cùng update, nhiều lỗi/group, retry sau cooldown, group độc lập, gửi không chắc chắn, RLS và RPC grants.
- `deno test --no-lock --no-check --allow-env --allow-read --ignore=supabase/functions/_shared/managed-groups.test.ts supabase/functions`: **274 pass, 5 fail**. File ignored dùng `bun:test`; không tuyên bố toàn bộ Edge pass.
- 5 lỗi runtime đã tái hiện trên bản sao HEAD (79 pass, 5 fail): persona `factual mode bỏ qua wit/charm block`; settings `ensureSettings surfaces insert failures instead of reporting no configuration`; spam `mention_bait: 2 foreign bots with only emoji/punct → detected`; pronoun `enforceVietnamesePronouns rewrites bot self-reference`; meditation `detectMeditationInvite: missing required parts is safe`.
- `git diff --check`: đạt; diff và file mới đã rà dữ liệu riêng tư/secret, không có token/JWT/private key thật. Các fixture đều tổng hợp.
- Type-check rộng bị chặn bởi lỗi sẵn có: FlagKey, biến chưa định nghĩa trong Angel/shared community, extension/type ở managed-groups và webhook-config tests; webhook check thêm mismatch client type với các imports legacy. Không chỉnh các lỗi ngoài phạm vi.

## Bước vận hành tiếp theo

1. Xác minh đúng Lovable project/backend và khoảng thời gian ảnh theo Malaysia Time. Chỉ export `created_at` (UTC+8), `action`, `message_id`, rule code và suffix lỗi xóa; không export message_text/username/actor/token/URL. Lưu ý reason cũ có thể chứa mention hoặc keyword, cần lọc trước xuất.
2. Đối chiếu group/message/time với Edge delete event. Log cũ thiếu description/category có thể không phân biệt được nguyên nhân chỉ từ mã 400; không suy diễn giới hạn thời gian từ mã đó.
3. Người vận hành xác minh quyền bot đúng group từ snapshot admin có thời điểm: status và can_delete_messages; không có snapshot hoặc lỗi truy vấn phải báo chưa xác minh. Chỉ gọi API khi có phê duyệt riêng. Không thay quyền để thử.
4. Nếu có false positive xác nhận, tạo fixture đã sạch cho đúng rule/pipeline và regression trước khi sửa detector.
5. SQL đã được áp dụng trực tiếp trên `funprofile-production` ngày 2026-10-05 (MYT). Migration `20261005010000_telegram_moderation_notice_dedupe` được ghi nhận là applied bằng `supabase migration repair`, không chạy DDL lần hai. Bảng bật RLS; chỉ `service_role` có quyền bảng và gọi RPC. Trước khi deploy, kiểm tra lại migration list và xác nhận phiên bản Edge Function mục tiêu.

Chưa deploy/merge/push code tại thời điểm ghi báo cáo này. Không gửi tin thử Telegram production.
