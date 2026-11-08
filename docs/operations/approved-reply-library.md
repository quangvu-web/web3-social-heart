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

**Production đã áp dụng ngày 08/11/2026. Không chạy lại bước migration bên dưới trên production.** File `20261108000000_approved_telegram_replies.sql` là SQL nguồn; Lovable đã thực thi và ghi nhận SQL này dưới version `20261108091249`, file `20261108091249_6d8e0c4d-e326-4513-8ed9-75196b1f7185.sql`. Phải đối chiếu schema/history, không coi bản SQL nguồn là một migration production còn thiếu để chạy lại. Không chạy hàng loạt các file migration khi chưa đối chiếu hai bản này.

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
- `deno test --allow-read --allow-env --allow-net supabase/functions/_shared/approved-replies_test.ts supabase/functions/telegram-community-webhook/caption-routing_test.ts supabase/functions/telegram-community-webhook/caption-operators_test.ts supabase/functions/_shared/telegram-dm-text-context_test.ts` — 22 pass, 0 fail, kiểm tra kiểu dữ liệu bật sau cập nhật triển khai 08/11.
- `deno check supabase/functions/telegram-community-webhook/index.ts` — pass sau cập nhật triển khai 08/11: Lovable bổ sung ba FlagKey đang dùng; năm import `SupabaseClient` chỉ dùng cho kiểu dữ liệu được đồng bộ về `npm:@supabase/supabase-js@2`. Không thay đổi logic ingest.
- Migration chưa apply được điều chỉnh GRANT trước ENABLE RLS theo yêu cầu công cụ Lovable; kiểm thử PostgreSQL nhúng chạy lại pass.

## Biên bản triển khai production — 08/11/2026 (MYT)

- Lovable xác minh HEAD `183094ab226ece167c6018cf46b383aabd0847a9` trước triển khai. GitHub và local đã đồng bộ commit tự sinh sau migration `9196d9cb31d423aa539fc12d10896bf0d2955e33`.
- Migration history ghi nhận version `20261108091249`, tên `6d8e0c4d-e326-4513-8ed9-75196b1f7185`; đã đối chiếu bằng SELECT trên `supabase_migrations.schema_migrations`. Không chạy lại migration nguồn.
- Kiểm chứng SQL độc lập: bảng `telegram_approved_replies` tồn tại, 0 dòng, RLS bật, một admin policy dùng `has_role`, một trigger `prepare_telegram_approved_reply`; `anon` không có SELECT; `authenticated` có SELECT/INSERT/UPDATE dưới RLS. Không nhập hoặc duyệt câu trả lời tự động.
- `telegram-community-webhook` đã deploy; dashboard ghi nhận deployment 17:13 MYT. Verify JWT vẫn tắt theo cấu hình hiện có. GET endpoint production trả 200; POST `{}` không có secret trả 401. Không gửi tin Telegram thật.
- ZIP tải từ chính trang Code của function production có 57 file TypeScript; tất cả khớp main khi chuẩn hóa BOM/xuống dòng. Có cả `approved-replies.ts`, `approved-replies-policy.ts` và nhánh `approved_library`. SHA-256 entrypoint production: `c91005d34d9229fc415ce58181827d189b6b579a5cbbdf2c06a7bbf9d343645e` (không BOM). CLI vẫn thiếu quyền đọc metadata nên số revision của function chưa xác minh; không suy ra số revision từ commit.
- Publish frontend hoàn tất, Lovable hiển thị **Your website was updated**. Đã mở URL live; phiên trình duyệt hiện chưa đăng nhập và bị đưa tới `/law-of-light`. Chưa kiểm thử form admin bằng tài khoản admin đã đăng nhập.
- Công cụ migration tự sinh file SQL đã ghi nhận và cập nhật `src/integrations/supabase/types.ts`; Codex chỉ đồng bộ về local, không sửa tay types hoặc migration đã apply.
- Publish có các cảnh báo bảo mật có sẵn về access rules và storage. Không sửa policy hiện có, không đánh dấu Ignore và không tắt kiểm tra bảo mật trong nhiệm vụ này; cần rà soát riêng.

**Còn nghiệm thu nghiệp vụ:** đăng nhập admin tại `/admin?tab=approved-replies`, biên tập/duyệt một FAQ thực sự phù hợp, rồi thử câu hỏi chuẩn, biến thể, sai nhóm/ngôn ngữ và thu hồi như các bước 4–7. Thư viện đang trống nên bot vẫn đi đường AI hiện có cho tới khi có mục được duyệt. Chưa gọi luồng FAQ Telegram end-to-end là đã nghiệm thu.
