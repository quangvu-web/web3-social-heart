# Chống lặp thông báo khi mời bot vào nhóm chưa quản lý

Ngày điều tra: 2026-10-05, Malaysia Time (UTC+8). Bot được báo cáo: funrich_community_bot. Group được báo cáo: -1002504038861. Không đọc log production hoặc gọi API Telegram production trong phiên.

## Nguyên nhân xác nhận bằng mã và test

`processUpdate` phân luồng mỗi update độc lập. Trước sửa:

- `handleMyChatMemberUpdate`: mọi new status member/administrator/restricted + settings null gọi `handleUnauthorizedGroup(sendNotice=true)`; không kiểm tra transition từ chưa tham gia, không có claim.
- `message.new_chat_members`: chỉ cần bất kỳ member.is_bot nào + settings null cũng gọi cùng helper với sendNotice=true; không phân biệt bot được mời có phải bot hiện tại.
- Tin nhắn thường + settings null gọi cùng helper dù sendNotice=false, nên vẫn gọi leaveChat thêm.
- Helper luôn ghi `unauthorized_group_left` trước khi gửi/rời, không kiểm tra kết quả Bot API; lỗi API trả ok:false không nhất thiết throw.
- `my_chat_member` chạy background rồi HTTP trả 200 trước khi công việc được xử lý bền vững. Service-message join chạy inline. Hai nhánh không đồng bộ và retry/concurrency không có bảo vệ.

Do đó hai loại update hoặc retry có thể tái tạo hai thông báo và hai lần gọi rời nhóm trong fixture. Đây là nguyên nhân có bằng chứng bằng code/test; chưa xác nhận loại update/timing thực sự gây hai tin trong ảnh production.

## Nguồn chính và vòng đời

Telegram định nghĩa my_chat_member là cập nhật trạng thái thành viên của chính bot; update_id hỗ trợ bỏ qua update gửi lại. [Telegram Bot API — Update](https://core.telegram.org/bots/api#update).

Repo đã có my_chat_member trong COMMUNITY_WEBHOOK_ALLOWED_UPDATES; diagnoseCommunityWebhook gửi danh sách đó khi đăng ký. Handler đã xử lý riêng. Thay đổi mới:

- Chỉ my_chat_member chuyển absent (left/kicked hoặc restricted.is_member=false) sang present được quyền xử lý lần mời chưa quản lý. Thay quyền member→administrator không phải lần mời mới; restricted cần is_member rõ ràng.
- Nhánh service message đi kèm và tin nhắn thường không gửi notice/leave, chỉ audit phù hợp. Nhánh xử lý nhóm đã có settings giữ nguyên đường xử lý/authorized_group_joined.
- Readiness backend và frontend bắt buộc my_chat_member trong danh sách explicit; thiếu thì chưa verified. Danh sách omitted/empty vẫn theo defaults Telegram (chat_member là phần thiếu). Không đăng ký lại webhook trong phiên.
- my_chat_member xử lý inline, trước sweep rule/verification không liên quan. Settings lỗi hoặc claim chưa xác minh → 503 trước side effects để có thể retry. Settings null chỉ có nghĩa chưa quản lý khi query thực sự thành công.

**Gate vận hành:** chưa xác minh allowed_updates/endpoint đang hoạt động của production. Người vận hành phải xác nhận snapshot getWebhookInfo phù hợp (hoặc tác vụ đọc trạng thái đã được cho phép riêng) trước khi deploy. Không coi đăng ký trong source là bằng chứng production hiện đang đăng ký đúng. Không có fallback gửi/rời từ service message vì không có khóa membership transition đáng tin cậy ở đó.

## Claim bền vững riêng

Migration mới `20261005020000_telegram_unauthorized_bot_invites.sql` chỉ được tạo, không áp dụng production. Table metadata có RLS; service_role được SELECT/INSERT; RPC SECURITY DEFINER search_path rỗng, revoke PUBLIC/anon/authenticated, grant EXECUTE service_role.

Unique key `(bot_id, group_id, update_id, event_date)` đại diện update membership chính của một lần mời. RPC INSERT ON CONFLICT DO NOTHING chỉ cho một instance claim; các retry nhận duplicate. Date thêm vào key để không dùng update_id như một counter vĩnh viễn. Lần mời mới có identity mới, kể cả cùng giây, nên không bị group cooldown hay khóa vĩnh viễn chặn.

RPC recheck settings trước claim: nhóm đã được thêm khi caller còn thấy null trả managed. Query lỗi abort transaction, không chuyển thành unmanaged. Recheck này không serialize mọi thay đổi Managed Groups trong lúc đang gửi Telegram; không khẳng định giao dịch DB có thể khóa cả side effect bên ngoài.

Không dùng telegram_moderation_notice_events/tg_claim_moderation_failure_notice: khóa message + cooldown/group không phù hợp vòng đời mời lại. logMemberEvent hiện loại trừ user.is_bot; không dùng bảng member events để ép xử lý bot.

## Side effects và audit

Sau claim: audit started → một lần thử notice → audit sent/failed → một lần thử leave → audit left/failed. Notice failure không ngăn leave. Chỉ log left khi HTTP/API ok và leaveChat result === true. Audit metadata có group ID, update ID, event date và mã trạng thái; không có token/webhook URL/group title/nội dung tin nhắn. Bản notice gửi vào nhóm vẫn hiển thị Group ID và tên nhóm đã escape HTML, với text tiếng Việt.

Không reclaim claim sau lỗi gửi/rời chưa chắc chắn: ưu tiên tối đa một lần thử mỗi side effect. Crash sau claim hoặc Telegram lỗi có thể khiến không gửi/không rời; cần review vận hành, không tự retry side effects. Đây là at-most-once attempts, không phải bảo đảm exactly-once delivery. Audit DB lỗi vẫn có event Edge metadata; giữ claim keys qua retry, không xóa keys khi bot rời. Không có biến trong bộ nhớ production làm cơ chế dedupe.

## Kiểm thử đã chạy

- `bun test src`: **40 pass, 0 fail**.
- `bun test` toàn repo: **43 pass, 32 fail/32 errors**; Bun quét test Deno và không resolve npm:/module Deno. Không gọi toàn repo pass.
- `deno test --no-lock` với telegram-unauthorized-invite, telegram-webhook-config, telegram-webhook-diagnostics: **22 pass, 0 fail**, có type-check.
- Test hồi quy HTTP chạy trên bản sao webhook HEAD gốc: **fail đúng hành vi**, 7 send/7 leave thay vì 1/1 với service update + sáu bản my_chat_member. Mã sửa đạt 1/1 cùng fixture.
- Test webhook thực: **1 pass**, dùng `--no-check --allow-env --allow-read`. Capture handler Deno.serve, không mở server; toàn bộ fetch/DB/Telegram là fixture, không có allow-net. Bao phủ hai loại update, concurrency, retry, ordinary message, reinvite, lỗi settings/RPC→503→retry, managed group và thay quyền.
- Test DB/preflight local: **1 pass**, có type-check. PostgreSQL mới tạm, Unix socket, nhiều kết nối psql thật. Bao phủ retry/concurrency/reinvite/cùng giây, RPC recheck managed, RLS/grants và query settings lỗi rollback claim. Tiến trình con dùng clearEnv + PATH/LC_ALL allowlist; chạy đạt ngay cả khi parent có PGHOSTADDR/PGSERVICE/PGDATABASE giả. SQL migration chỉ áp dụng lên fixture tạm đã xóa.
- Suite Edge rộng `--no-check --allow-env --allow-read --ignore=supabase/functions/_shared/managed-groups.test.ts supabase/functions`: **282 pass, 5 fail**; ignored file dùng bun:test.
- 5 lỗi runtime legacy tái hiện trên bản sao HEAD hiện tại: **80 pass, 5 fail**. Tên lỗi: persona factual-mode wit/charm; ensureSettings insert failure; mention_bait hai bot emoji; enforceVietnamesePronouns self-reference; detectMeditationInvite missing parts.
- `deno check` webhook còn **13 lỗi legacy**, tái hiện cùng 13 lỗi trên HEAD: FlagKey trong Angel/shared community, các biến chưa định nghĩa và mismatch SupabaseClient type trong ingest imports legacy. Không sửa các chức năng ngoài phạm vi. Test webhook cần no-check vì import graph này.
- Rà soát độc lập: 7 helper/webhook tests pass; không tìm thấy lỗi chặn về claim/routing. Rủi ro PG* kế thừa của test đã sửa và chạy lại. Thay đổi lockfile tự phát do công cụ đã hoàn tác.
- `git diff --check` đạt; đã rà diff và file mới để không đưa dữ liệu riêng tư/secret vào commit. Fixture chỉ dùng dữ liệu tổng hợp.

## Bước vận hành còn lại

1. Xác nhận đúng project và snapshot allowed_updates/endpoint production, đặc biệt my_chat_member. Đối chiếu metadata update/time/group gần ảnh, không export message text, username, token hoặc webhook URL. Chưa có chứng cứ production trong phiên này.
2. Duyệt migration, chạy preflight đọc-only trước/sau, người vận hành áp dụng riêng trước deploy code phụ thuộc RPC. Không deploy code trước migration: claim lỗi sẽ 503 và bot chưa có side effects.
3. Resolve hoặc đánh giá riêng các lỗi type-check legacy trước khi phát hành; kiểm tra staging bằng fixture, không gửi tin thử lên nhóm production.
4. Theo dõi duplicate, notice_failed, leave_failed và claim_unverified. Nếu có claim mà side effect không chắc chắn, admin xử lý có bằng chứng; không tự xóa claim để retry.

Không thay quyền/webhook production, không gửi tin thử, không deploy/merge/push. Giữ thay đổi local trên nhánh riêng.
