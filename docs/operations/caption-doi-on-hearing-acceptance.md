# Sửa lỗi nghe “đợi ơn” — 28/10/2026

Mọi thời gian bên dưới theo Malaysia Time (UTC+8). Base: `7bea09b`.

## Phạm vi và bản vá

- Thêm duy nhất `"đội ơn"` vào `KEYTERMS`; test dựng payload từ khai báo production và xác nhận toàn bộ từ khóa cũ giữ nguyên.
- `HEARING_CORRECTIONS` thêm hai literal: `đợi ơn → đội ơn`, `Đợi ơn → Đội ơn`. Dùng `replaceAll` cho literal, giữ nguyên regex và hành vi bốn cặp cũ. Không dùng `\b` cho tiếng Việt có dấu.
- Sửa transcript trước `textSource` và trước dịch. Không thay đổi bộ dịch, prompt, model, provider, UI hoặc schema.
- Deploy `angel-caption` **v37**, trạng thái ACTIVE, lúc **07:37:28.976**. Không restart phiên live. Keyterms mới áp dụng khi tạo bot/STT mới; lưới sửa transcript áp dụng cho webhook sau deploy.

## Sửa dữ liệu đã lưu

Đúng phiên `6wj7cqbp38u9` (`2e65d8b9-7429-4508-a8ce-72ecfc389e58`). Snapshot trước sửa lúc **07:36:48.997**; sửa và đọc lại lúc **07:38:32.894**.

| Kiểm tra | Kết quả |
| --- | --- |
| Dòng có `text_source` chứa cụm sai | 1 |
| Số seq / danh sách seq sửa | 1 / `439` |
| Số lần thay trong `text_source` | 4 |
| Số lần thay trong `text_vi` | 4 |
| Còn cụm sai trong `text_source` sau sửa | 0 dòng |
| Còn cụm sai trong `text_vi` sau sửa | 0 dòng |

Trích đoạn trước/sau: `cha dạ đợi ơn cha` → `cha dạ đội ơn cha`.

Chỉ PATCH `text_source` và `text_vi`, với điều kiện khớp dữ liệu trước sửa và đúng ID/phiên. Mỗi write yêu cầu count = 1, rồi GET riêng để đối chiếu. `id`, `session_id`, `seq`, `dedupe_key`, `created_at`, `text_en` đều giữ nguyên. Tiếng Anh đã đúng (`Thank you, our Teacher…`) được giữ nguyên, không dịch lại. Không sửa phiên khác.

## Kiểm thử

- RED: 14 đạt, 3 thất bại đúng chỗ thiếu correction/keyterm.
- Deno typed, hai file `caption-utils_test.ts` và `bot-config_test.ts`: **17 đạt, 0 lỗi**. Có assertion chính xác `applyHearingCorrections("cha dạ đợi ơn cha") === "cha dạ đội ơn cha"`, câu lặp, viết hoa đầu câu, idempotence, câu không liên quan và bốn cặp sửa cũ.
- Toàn bộ thư mục caption: **107 đạt, 0 lỗi, 1 bỏ qua** bằng `deno test --no-lock --node-modules-dir=none --no-check --allow-env --allow-net --allow-read supabase/functions/angel-caption`. Test bỏ qua có sẵn là dry run 600 dòng/8 map/1 reduce, không phải nghiệm thu nội dung AI.
- Frontend `bun test src`: **65 đạt, 0 lỗi**. Bare `bun test` có 70 lỗi do nạp các file Deno; không báo toàn repo đạt.
- Review độc lập: không có phát hiện chặn; kiểm tra cả phạm vi bản vá và CAS của bước sửa dữ liệu.

## Nghiệm thu live

Bé chọn đợi lần MC nói tự nhiên tiếp theo trong phiên hiện tại. Chỉ dòng mới sau deploy mới tính là bằng chứng; seq 439 đã sửa không tính. Chưa quan sát thấy lần xuất hiện mới tại lần đọc **07:41:28**, seq mới nhất **699**, cả hai cột còn 0 dòng chứa cụm sai.

## Dọn công cụ và bàn giao

Probe sửa dữ liệu có xác thực và thời hạn, chỉ cho đúng phiên. Trạng thái dọn probe và commit sẽ được cập nhật khi hoàn tất.
