# Bàn giao kiểm tra trước merge Telegram Operations

Ngày kiểm tra: 30/09/2026, Malaysia Time (UTC+8).
Nhánh: `feature/telegram-operations-admin`; nền trước sửa: `f9e5c0b`.

## Phần sửa

- Thêm `@types/bun` chính thức và khóa dependency bằng `bun.lock`.
- `tsconfig.app.json` chỉ nạp global type Vite; test trong `src` được chuyển sang `tsconfig.test.json`, không bỏ kiểm tra.
- `tsconfig.test.json` kiểm tra toàn bộ test `.test.ts/.test.tsx` trong `src` và các file TypeScript trong `tests`, với type Bun/Vite và cùng tùy chọn compiler của app.
- `bun run typecheck` chạy lần lượt app, test và Node/Vite; dừng ngay nếu có lỗi. Không thêm `any`, `@ts-ignore` hoặc shim type giả.
- DM: lỗi tải không hiện KPI/count bằng 0, khóa CSV; tải lại thành công mới xác nhận dữ liệu rỗng.
- Feedback và duyệt thưởng: count chưa xác minh không hiện 0.
- Member analytics: biểu đồ báo lỗi thay vì hiển thị biểu đồ rỗng/cũ; ẩn event cũ trong lúc tải/lỗi.
- Global persona override: khóa ô nhập chưa xác minh và giải thích ô trống không xác nhận dùng mặc định.
- Test render 11 trường hợp trên component thật, chỉ giả lập backend reads; không có phương thức ghi trong client giả lập. Suite chạy ở subprocess để không làm nhiễu mock của auth tests.

## Lệnh và kết quả

| Lệnh | Kết quả |
| --- | --- |
| `bunx tsc --noEmit -p tsconfig.app.json` trước sửa | FAIL, exit 2; 11 lỗi TS2307 thiếu `bun:test` |
| `bun run typecheck` sau sửa | PASS, exit 0 |
| `bun test ./tests/admin/loadErrors.cases.tsx` | PASS, 11/11; trước sửa tái hiện các lỗi count/KPI/chart và ô persona |
| `bun test ./src ./tests` | PASS, 55/55 test cấp suite, gồm subprocess admin 11 trường hợp; exit 0 |
| `bun run build` | PASS, exit 0; Vite build production và PWA hoàn tất |
| `git diff --check` | PASS |
| `bun run test` (quét toàn repo) | FAIL, 55 pass, 11 fail/11 lỗi nạp test Deno; exit 1 |

Lệnh typecheck mở rộng chính xác thành:

```sh
tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.test.json && tsc --noEmit -p tsconfig.node.json
```

`bun run test` vẫn gọi `bun test` như trước. Các test Deno dùng import `npm:`/URL `deno.land`, không chạy được bằng Bun. Không đổi script để che các lỗi này. Các file bị lỗi nạp:

- `supabase/functions/lang_test.ts`
- `supabase/functions/_shared/telegram-community.test.ts`
- `supabase/functions/_shared/angel-postprocess.pronoun.test.ts`
- `supabase/functions/_shared/angel-context-bridge.test.ts`
- `supabase/functions/_shared/angel-image-enrich.test.ts`
- `supabase/functions/_shared/telegram-join-guard.test.ts`
- `supabase/functions/_shared/telegramGroup.test.ts`
- `supabase/functions/_shared/angel-image.test.ts`
- `supabase/functions/_shared/telegram-community.spam.test.ts`
- `supabase/functions/live-watchdog-cleanup/zombie_recording_test.ts`
- `supabase/functions/_shared/angel/persona/__tests__/persona-builder.test.ts`

Lần thử `bun test src tests` cũng khớp thư mục Deno `__tests__` và FAIL một lỗi nạp; dùng đường dẫn tường minh `./src ./tests` mới đúng phạm vi Bun. Một lần chạy suite UI khi build/typecheck đồng thời vượt timeout mặc định 5 giây; wrapper subprocess hiện có timeout 30 giây và lần chạy cuối đạt 55/55.

Cảnh báo còn lại: build báo dữ liệu Browserslist/baseline cũ, chú thích PURE từ dependency và chunk lớn; test persona phát cảnh báo DOM nesting có sẵn (`Badge` dạng div trong p). Log lỗi backend giả lập là chủ ý của test đường lỗi. Các cảnh báo không được diễn giải thành kiểm thử runtime thành công.

## Phiên đăng nhập và checklist thủ công còn lại

Không xác nhận được phiên ứng dụng phù hợp: preview trong Lovable hiện nút đăng nhập và bản SHA `95469d25`; preview độc lập vào `/admin` chuyển sang `/law-of-light`. Phiên đăng nhập dashboard backend/Lovable không phải phiên admin của FUN Profile. Không tự chấp nhận điều khoản, tạo tài khoản hoặc cấp quyền để vượt bước này.

1. Mở preview thực sự build từ nhánh/commit bàn giao (không dùng bản `95469d25` cũ), ngoài iframe nếu cần Google OAuth. Đăng nhập tài khoản admin đã có; tự hoàn tất các bước đồng ý/2FA nếu được yêu cầu.
2. Mở `/admin?tab=telegram`, rồi các tab `dm-bot`, `ai-conversations`, `feedback`, `members`, `allowlists`, `father`, `angel-persona`, `prompt-versions`, `feature-flags`, `rewards`. Xác nhận request tải thành công, không lỗi quyền; dữ liệu rỗng chỉ hiển thị khi request thành công.
3. Mở `/admin?tab=security`, kiểm tra request `admin-app-keys` với body `{"action":"list"}` trả 200 và danh sách metadata key đã che. Không bấm Generate/Rotate/Revoke.
4. Với một tài khoản non-admin đã có trong phiên trình duyệt riêng, dùng access token của chính phiên đó gọi cùng endpoint, body chỉ `list`. Mong đợi **403**, không trả danh sách key. Không thay bằng token giả/không token (401 không chứng minh kiểm tra role). Không gửi token vào chat hoặc lưu trong repo.

Ví dụ chỉ đọc, dùng biến môi trường tạm của phiên test:

```sh
curl -i 'https://xoiceivuqbxnmpfdiklg.supabase.co/functions/v1/admin-app-keys' \
  -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $NON_ADMIN_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"action":"list"}'
```

5. Trên preview nhánh, chặn request đọc hoặc bật Offline rồi tải lại các tab: phải hiện lỗi/chưa xác minh, không 0 giả/danh sách trống/mặc định; thao tác ghi/export liên quan bị khóa. Bỏ chặn rồi Thử lại: tải thành công mới khôi phục trạng thái dữ liệu.
6. Kiểm tra mobile và thời gian MYT; chạy nhóm test backend bằng runtime Deno trong môi trường phù hợp trước khi coi toàn bộ test suite là xanh.

## Mức sẵn sàng merge

Typecheck, test Bun và production build đạt. Chưa đủ bằng chứng kết luận toàn bộ kiểm tra trước merge hoàn tất: test Deno toàn repo chưa đạt dưới lệnh hiện tại, admin/non-admin thật và preview đúng commit chưa được xác nhận.

Lượt này không áp dụng lại migration, không deploy backend, không tạo/rotate/revoke key và không merge main. Không commit `dist/`, `public/version.json` hay `src/generated/appVersion.ts` sinh bởi build.
