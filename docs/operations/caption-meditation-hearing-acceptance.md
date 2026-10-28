# Sửa lỗi nghe trong bài cảm ơn — 28/10/2026

Thời gian báo cáo theo Malaysia Time (UTC+8). Base `08740a1`, branch `fix/caption-meditation-hearing`.

## Bản vá

Thêm đúng 10 KEYTERMS: `gia hộ`, `tinh tấn`, `hồi hướng`, `thiền nhân`, `buổi thiền`, `thời thiền`, `chư vị đại giác ngộ`, `hộ pháp`, `mẹ em bé Angel Cam Ly`, `em bé Angel Cam Ly`. Giữ toàn bộ term cũ, gồm `đội ơn`. Test dựng payload AssemblyAI thực tế từ `KEYTERMS` production, xác nhận mỗi term mới có đúng một lần và danh sách cũ nguyên vẹn.

Thêm 12 literal chủ dự án duyệt và một cụm dài đã đối chiếu:

| Sai | Đúng |
| --- | --- |
| đỡ ơn | đội ơn |
| Đỡ ơn | Đội ơn |
| giao hộ | gia hộ |
| gia hội | gia hộ |
| thập tinh tấn | thật tinh tấn |
| bổ thiền | buổi thiền |
| hầu hứa | hồi hướng |
| hầu ứng | hồi hướng |
| bé chùa Cam Ly | em bé Angel Cam Ly |
| bệ chùa Cam Ly | em bé Angel Cam Ly |
| mẹ chùa Cam Ly | mẹ em bé Angel Cam Ly |
| bạn chùa Cam Ly | em bé Angel Cam Ly |
| thời thiên thập tân tấn | thời thiền thật tinh tấn |

Cụm cuối được kiểm chứng nguyên văn tại seq 461 và đối chiếu câu đúng chủ dự án cung cấp. Không thay riêng `thập tân` vì dòng thật đã có chữ `tấn` tiếp theo, sẽ tạo `tinh tấn tấn`. Không tạo các luật chung cho `thiên`, `tân`, `thiện nhân` hoặc tên người.

Dùng literal `replaceAll` như cặp `đợi ơn` cũ; không dùng `\b` cho tiếng Việt. Bốn regex tiếng Anh và hai literal cũ giữ nguyên. Corrections vẫn chạy trước `textSource` và trước dịch. Không sửa translator, prompt, model, cổng provider, timeout/retry, UI hoặc schema.

Deploy `angel-caption` **v38**, ACTIVE lúc **14:28:06.438**. Không restart phiên. KEYTERMS gửi khi tạo bot/STT mới; corrections áp dụng cho webhook sau deploy.

## Sửa dữ liệu phiên 7a710178

Đã xác định duy nhất UUID `7a710178-174b-4a25-a906-741ce720a466`, public code `k4e5yd55zfu5`. Phiên đã kết thúc ngày **25/10/2026**, có 678 dòng; đây không phải phiên thử live mới.

- Trước sửa lúc **14:28:42.387**: 12 dòng source và cùng 12 dòng VI chứa literal sai đã duyệt.
- Sửa lúc **14:28:51.411**: **12 dòng / 12 seq** — `39, 41, 42, 43, 44, 46, 459, 460, 461, 463, 464, 497`.
- Mỗi dòng chỉ PATCH `text_source` và `text_vi`, có CAS kiểm tra dữ liệu cũ, ID/phiên/seq/dedupe/thời gian/English, yêu cầu write count = 1. GET riêng xác nhận giá trị mới và metadata bất biến.
- `id`, `session_id`, `seq`, `speaker_name`, `dedupe_key`, `created_at`, `text_en` giữ nguyên cả 12 dòng. Không dịch lại English đã lưu; các lỗi English cũ do STT cũ vì vậy không được viết lại trong bước này.
- Đọc lại probe lúc **14:29:20.065** và đọc độc lập bằng quyền guest lúc **14:29:20.975**: **0 dòng** chứa literal sai trong `text_source`, **0 dòng** trong `text_vi`; tổng vẫn 678 dòng.

“0 dòng” chỉ áp dụng đúng các literal trong bảng. Còn lỗi khác ngoài danh sách được duyệt, ví dụ `bé chùa Camly` (seq 461, khác khoảng trắng/case của literal đã duyệt), `ban chùa Cam Ly` (44), `mấy anh chùa cam ly` / `hồ pháp` (43), `mẹ xây đất` (42), `thiện nhân` (46), `thơ thiền` (44). Chưa tự sửa các cụm này; không báo toàn bộ transcript đã sạch lỗi.

Lovable query_database không truy cập được DB, kể cả `SELECT 1`; dùng probe tạm có hash bearer, hạn 2 giờ, giới hạn một phiên và cặp sửa cố định. Đã xóa function remote và xác minh không còn, xóa source local và token sau sửa. Không chạy migration.

## Kiểm thử

- RED: **17 đạt, 15 thất bại** đúng các correction/KEYTERMS thiếu.
- Deno typed mục tiêu: **32 đạt, 0 lỗi**, gồm từng cặp mới, câu hỗn hợp, idempotence, không sửa các cụm chưa duyệt và toàn bộ cặp cũ.
- Toàn bộ caption: **122 đạt, 0 lỗi, 1 bỏ qua**, với `deno test --no-lock --node-modules-dir=none --no-check --allow-env --allow-net --allow-read supabase/functions/angel-caption`. Test bỏ qua có sẵn là dry run summary 600 dòng, không phải nghiệm thu STT.
- Frontend `bun test src`: **70 đạt, 0 lỗi**. Bare `bun test` vẫn 70 lỗi nạp test Deno/Edge bằng Bun; không báo toàn repo đạt.
- Review độc lập không có phát hiện chặn; reviewer tự chạy Deno typed mục tiêu **32 đạt**. Multirow repair dùng từng CAS, không phải một transaction; không có conflict trong lần chạy này.

## Nghiệm thu live

Bé cung cấp phiên `yxjuet3re8y5` (UUID `7ebf7f53-0d4a-479a-aefd-167a8edca9d0`), đang live. Phiên mở **13:23:08.805**, trước deploy; không thể khẳng định bot cũ đã nhận KEYTERMS mới. Kiểm tra các dòng mới sau deploy/cursor baseline seq 538 để nghiệm thu đầu ra của corrections, không dùng các dòng đã backfill hoặc các cụm có sẵn trước deploy làm bằng chứng.

**Bé yêu cầu bỏ qua nghiệm thu live** trong phiên ngày 28/10/2026. Tiêu chí (c) được miễn theo yêu cầu, **chưa kiểm chứng live**, không đánh dấu đạt. Trước khi tiến trình theo dõi dừng, lần đọc cuối lúc **14:34:18.662** có đến seq **545**; bộ đệm đã ghi nhận `đội ơn` ở seq 542 và `buổi thiền` ở seq 543, chưa có đủ năm cụm cần thử. Đây chỉ là quan sát một phần, không phải nghiệm thu đạt. Không tạo transcript/webhook giả. Bằng chứng dữ liệu sửa lưu tại [caption-meditation-hearing-evidence.json](./caption-meditation-hearing-evidence.json).

Đã dừng theo dõi phiên thử. Code đã push nhánh `fix/caption-meditation-hearing` (commit sản phẩm `28f68e3`), backend đã deploy v38; chưa merge `main` trong đợt này.
