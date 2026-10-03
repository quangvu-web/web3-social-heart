# Kiểm thử local migration Telegram join recovery

Chỉ dùng với cluster PostgreSQL test mới, không dùng fixture trên database thật.
`fixture.sql` là schema tối thiểu phục vụ kiểm thử, không phải dump production.
UUID, JSONB, unique key event và quyền có sẵn được giả lập; phải đối chiếu catalog
production trước triển khai. Migration giữ nguyên RLS/grants bảng hiện có.

## Chạy lại

Ví dụ với PostgreSQL Homebrew; tạo cluster riêng, không mở TCP:

```sh
PG_BIN=/opt/homebrew/opt/postgresql@17/bin
TEST_ROOT=$(mktemp -d /private/tmp/fun-join-pg.XXXXXX)
"$PG_BIN/initdb" -D "$TEST_ROOT/data" --auth-local=trust --auth-host=reject --encoding=UTF8 --no-locale
"$PG_BIN/pg_ctl" -D "$TEST_ROOT/data" -l "$TEST_ROOT/server.log" -o "-c listen_addresses='' -k $TEST_ROOT -p 55437" -w start
"$PG_BIN/createdb" -h "$TEST_ROOT" -p 55437 fun_join_recovery_test
PSQL=("$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -h "$TEST_ROOT" -p 55437 -d fun_join_recovery_test)
"${PSQL[@]}" -c "SELECT current_database(), inet_server_addr(), current_setting('listen_addresses');"
"${PSQL[@]}" -f tests/sql/telegram-join-recovery/fixture.sql
"${PSQL[@]}" -f tests/sql/telegram-join-recovery/preflight.sql
```

Nếu preflight có duplicate/error, **dừng**, không sửa/xóa dữ liệu để vượt kiểm tra.
Nếu không có duplicate:

```sh
"${PSQL[@]}" -1 -f supabase/migrations/20261003020000_telegram_join_event_recovery.sql
"${PSQL[@]}" -f tests/sql/telegram-join-recovery/rejection.sql -f tests/sql/telegram-join-recovery/checks.sql
python3 tests/sql/telegram-join-recovery/concurrency.py "$PG_BIN/psql" "$TEST_ROOT" 55437
# Chạy lại migration và test; không bọc các file test BEGIN/ROLLBACK bằng -1.
"${PSQL[@]}" -1 -f tests/sql/telegram-join-recovery/preflight.sql -f supabase/migrations/20261003020000_telegram_join_event_recovery.sql
"${PSQL[@]}" -f tests/sql/telegram-join-recovery/rejection.sql -f tests/sql/telegram-join-recovery/checks.sql
"$PG_BIN/pg_ctl" -D "$TEST_ROOT/data" -m fast -w stop
```

## Bằng chứng lượt kiểm tra

- PostgreSQL 17.11 Homebrew; database `fun_join_recovery_test` và
  `fun_join_recovery_fresh_test`, Unix socket riêng, không có TCP listener.
- Trước sửa, `rejection.sql` thất bại tại assertion
  `explicit rejection must finish as retryable`.
- Sau sửa, regression và checks pass, dưới role `service_role`.
- 7 RPC: quyền execute dành cho service_role; anon/authenticated bị từ chối.
  RLS và quyền DML của 2 bảng fixture không đổi.
- 10 cột mới, recovery index và unique active-challenge index được tạo.
- Concurrent insert/claim/begin: mỗi thao tác đúng một winner.
- Fresh apply và reapply pass. Snapshot dữ liệu, RLS, grants bảng, ACL và
  định nghĩa RPC trước/sau reapply giống nhau.
- PostgreSQL parse/compile với `check_function_bodies=on`, thực thi cả 7 RPC.
  Chưa chạy công cụ lint độc lập như `plpgsql_check`.
- Deno: 24 pass, 0 fail; kiểm tra kiểu cho 2 suite, không phải toàn webhook:

```sh
deno test --no-config --no-lock --node-modules-dir=none --cached-only --deny-net supabase/functions/_shared/telegram-join-recovery.test.ts supabase/functions/_shared/telegram-verification.test.ts
```

Không cập nhật lockfile. Frozen lockfile còn lệch package.json (đã phát hiện ở
lượt trước); lệnh trên chỉ dùng cache, không thay cho kiểm chứng frozen build.

## Trước production

Người vận hành cần đối chiếu kiểu cột, unique index dedupe, role/grants/RLS
thực tế, owner của SECURITY DEFINER và chạy preflight read-only trên dữ liệu thật.
Các constraint mới dùng NOT VALID; fixture không chứng minh dữ liệu cũ hợp lệ.
Có duplicate phải dừng để xem xét riêng. Chỉ sau review/ủy quyền mới áp dụng
migration trong transaction, xác minh RPC/grants, rồi triển khai code phụ thuộc.
Chưa thực hiện bất kỳ bước production hoặc Telegram API nào trong lượt test này.
