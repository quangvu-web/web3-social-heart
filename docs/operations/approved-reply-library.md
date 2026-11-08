# Thư viện câu trả lời Telegram — bản đầu

## Phạm vi

- Admin → Hội thoại → **Thư viện câu trả lời** (`/admin?tab=approved-replies`).
- Soạn FAQ hoặc chọn một trong 20 lượt FUN Core thành công gần nhất của một nhóm để biên tập. Không tự nhập toàn bộ lịch sử; không lấy DM hay câu trả lời lỗi/dự phòng.
- Mỗi mục có câu hỏi chuẩn, tối đa 20 biến thể được người duyệt xác nhận tương đương, câu trả lời văn bản thuần, ngôn ngữ `vi/en`, phạm vi nhóm hoặc dùng chung và ngày hết hạn (cuối ngày MYT).
- Lưu luôn tạo bản nháp. Duyệt riêng sau khi đọc lại; sửa câu hỏi/biến thể/nội dung/ngôn ngữ/phạm vi/hạn dùng sẽ trở về nháp ở cả database, không chỉ UI. Có thể thu hồi và duyệt lại.
- Không cần key, embedding hay function mới. Không tự đẩy câu trả lời AI vào FUN Core knowledge.

## Đường trả lời

1. Giữ các gate trigger, spam và quota hiện có. Tra cứu thư viện với câu hỏi độc lập dạng text; bỏ qua ảnh, forward, trích dẫn, reply, yêu cầu công cụ, tự tương tác, yêu cầu dịch riêng và dữ liệu tức thời nhận biết được.
2. Chuẩn hóa chữ thường/NFC/khoảng trắng/dấu kết câu. Giữ dấu tiếng Việt, số và phủ định. Chỉ khớp câu hỏi hoặc biến thể đã duyệt; không tìm kiếm gần nghĩa tự động.
3. Chỉ đọc mục đã duyệt, còn hạn, đúng ngôn ngữ theo chính sách nhóm. Ưu tiên đúng nhóm trước mục dùng chung. Nhiều mục cùng phạm vi khớp thì bỏ qua thư viện.
4. Hit trả trực tiếp, không gọi FUN Core/Gemini. Vẫn chịu giới hạn lượt trả lời. Nội dung gửi plain text; ghi runtime/audit `provider=approved_library`, entry ID và revision. Gửi Telegram thất bại ghi lỗi, không đánh dấu đã trả lời thành công.
5. Miss, lỗi database hoặc timeout 1,5 giây thì giữ đường AI/cache/dự phòng hiện có. Không đưa nội dung thư viện vào TTL response cache, để lần tra cứu kế tiếp nhận biết thu hồi/sửa/hết hạn.

Thư viện hoạt động độc lập với kết nối FUN Core cho câu hỏi khớp. Vẫn cần backend database và Telegram. Lượt đang xử lý có thể đã đọc bản trước khi thao tác thu hồi hoàn tất.

Đây là bản FAQ có kiểm duyệt, **chưa bao gồm semantic search, tự học, hoặc Gemini soạn câu trả lời từ nhiều tài liệu**. Các câu hỏi mới tiếp tục qua FUN Core. Không phê duyệt các lời chúc cá nhân, sự kiện, thông tin ví/số dư, thông tin cần cập nhật hoặc nội dung chưa đối chiếu nguồn. Bản `en` cần được duyệt riêng; không dịch lại lúc hit.

## Triển khai theo thứ tự

1. Review nhánh/compare. Nhờ Angel trong Lovable áp dụng migration mới `20261108000000_approved_telegram_replies.sql` trên backend `xoiceivuqbxnmpfdiklg`. Codex không chạy migration production. Migration tạo bảng trống, grants và RLS admin qua `has_role`; không sửa bảng/quyền hiện có.
2. Merge sau review và kiểm tra Lovable sync frontend. Deploy lại **function hiện có** `telegram-community-webhook`; không tạo function thứ 101, không đổi config/secrets.
3. Kiểm tra `/admin?tab=approved-replies` bằng admin thật. Người không có quyền không được truy cập bảng qua API. Nếu migration/đọc bảng lỗi, UI phải báo lỗi, không hiển thị danh sách rỗng giả.
4. Soạn một FAQ ổn định, giữ phạm vi một nhóm thử nghiệm, chọn ngôn ngữ đúng, lưu nháp. Gửi câu hỏi độc lập khi bot được trigger: nháp chưa được dùng. Duyệt sau khi kiểm tra nội dung.
5. Gửi câu hỏi chuẩn và biến thể đã duyệt: log `approved_library`, đúng nội dung, không có call FUN Core cho lượt đó. Câu tương tự chưa duyệt, khác số/phủ định, sai ngôn ngữ, nhóm khác hoặc reply có ngữ cảnh phải đi đường cũ.
6. Sửa/thu hồi/hết hạn FAQ: lượt mới không nhận câu trả lời thư viện cũ. Thử hai admin mở cùng mục: người dùng revision cũ phải nhận lỗi tải lại, không ghi đè.
7. Kiểm tra lịch sử nguồn chỉ xuất hiện khi nhập đúng Group ID; mặc định giữ phạm vi nhóm nguồn. Không duyệt dùng chung nội dung riêng.

Rollback vận hành: thu hồi các mục đã duyệt; giữ bảng để bảo toàn nội dung. Nếu cần rollback code, revert commit theo quy trình bình thường, không viết lại lịch sử git.

## Kiểm chứng local

- `bun install --frozen-lockfile`
- `bun test src` — 71 pass, 0 fail.
- `bunx tsc --noEmit -p tsconfig.app.json` — pass.
- `bun run build` — pass; có cảnh báo kích thước bundle hiện có.
- `deno test --allow-env supabase/functions/_shared/approved-replies_test.ts` — 7 pass (kiểm tra kiểu dữ liệu bật).
- `deno test --no-lock --node-modules-dir=none --allow-read --allow-env supabase/functions/_shared/approved-replies-migration_test.ts` — 1 pass với PostgreSQL nhúng PGlite; fixture auth/roles riêng. Kiểm tra RLS admin/anon, lifecycle, chuẩn hóa, CAS, thu hồi và hạn dùng. Không chạm production.
- `deno test --no-check --allow-read --allow-env --allow-net supabase/functions/_shared/approved-replies_test.ts supabase/functions/telegram-community-webhook/caption-routing_test.ts supabase/functions/telegram-community-webhook/caption-operators_test.ts supabase/functions/_shared/telegram-dm-text-context_test.ts` — 22 pass, 0 fail. `--no-check` chỉ dành cho regression runtime do các lỗi type-check toàn webhook bên dưới.
- `deno check supabase/functions/telegram-community-webhook/index.ts` — fail với 8 lỗi ở các đường hiện có: ba FlagKey (`router.strict_mirror`, `group.per_user_history`, `factual.include_user_context`) và năm chỗ truyền SupabaseClient sang các hàm ingest khác phiên bản. Không sửa lan các file này.

Production migration, deploy, giao diện admin thật và Telegram end-to-end chưa được kiểm chứng trong nhiệm vụ này. Không gọi trạng thái này là “đã live”.
