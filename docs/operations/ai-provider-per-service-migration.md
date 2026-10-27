# Chạy gieo ba cờ AI Provider qua Lovable

Codex không chạy migration theo AGENTS.md. Phải hoàn thành bước này **trước khi deploy** code resolver/UI mới từ branch `feature/ai-provider-per-service`.

1. Chụp kết quả truy vấn trước khi chạy (không chỉnh cờ giữa snapshot và migration):

```sql
SELECT key, enabled, meta, updated_at
FROM public.angel_feature_flags
WHERE key IN ('ai.provider', 'ai.provider.caption', 'ai.provider.vision', 'ai.provider.ocr')
ORDER BY key;
```

2. Nhờ Angel trong Lovable chạy nguyên file `supabase/migrations/20261028000000_split_ai_provider_flags.sql` trong transaction của migration runner. Row nguồn `ai.provider` được khóa FOR UPDATE cho tới khi transaction kết thúc, tránh nguồn đổi giữa lúc copy. Không dùng CLI db push từ Codex.

3. Chạy lại SELECT trên và đối chiếu: ba row mới được tạo phải có `enabled` và toàn bộ `meta` bằng nguồn tại lúc migration thực thi. Migration không hardcode nhà cung cấp. Row đích có sẵn được giữ nguyên theo ON CONFLICT DO NOTHING; phải ghi riêng trường hợp này, không tuyên bố đã copy/ghi đè chúng. Row cũ không bị update/delete. Có thể chạy lại migration mà không đổi lựa chọn các dịch vụ.

4. Khi đã xác nhận gieo dữ liệu xong mới deploy code mới. Sau deploy, `ai.provider` **đã nghỉ hưu**: vẫn nằm trong database để đối chiếu, nhưng đổi nó không ảnh hưởng ba dịch vụ. Ba key con là nguồn sự thật duy nhất; env `AI_PROVIDER` cũng không override được các cờ con.

Nếu nguồn không tồn tại, migration báo lỗi và transaction dừng; không gieo giá trị phỏng đoán. Không tạo table, không thay schema, RLS, quyền hoặc secret.
