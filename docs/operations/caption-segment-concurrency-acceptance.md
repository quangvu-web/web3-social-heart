# Nghiệm thu độ trễ caption

Ngày 26/10/2026, giờ Malaysia (UTC+8). Bản sửa ở branch `feature/caption-segment-concurrency`. Chưa triển khai backend hoặc merge main; chưa nghiệm thu live sau sửa.

## Đối chứng phiên đang live

Đã đọc bằng public frontend configuration, chỉ SELECT, không dùng secret và không ghi dữ liệu. Lovable connector không truy cập được database dự án; dùng public read API sẵn có của ứng dụng.

Snapshot `a3mgge629vpf` lúc 14:41:36 MYT: 771 dòng, nội dung tới phút 109,39; dòng cuối insert 14:41:19 MYT. Nhịp 100 dòng đầu 3,785s, cuối 8,196s; không có seq trùng trong snapshot. Số liệu chi tiết ở `caption-latency-baseline-2026-10-26.json`.

| Bucket phút nguồn | Số dòng | Trung vị trễ (s) | Trễ lớn nhất (s) |
|---|---:|---:|---:|
| 0–10 | 80 | 11,85 | 60,32 |
| 10–20 | 77 | 8,03 | 33,67 |
| 20–30 | 90 | 6,37 | 35,36 |
| 30–40 | 88 | 5,11 | 28,28 |
| 40–50 | 77 | 5,48 | 55,38 |
| 50–60 | 75 | 27,04 | 47,66 |
| 60–70 | 66 | 15,30 | 58,24 |
| 70–80 | 67 | 22,02 | 47,37 |
| 80–90 | 48 | 14,87 | 46,44 |
| 90–100 | 59 | 12,96 | 36,77 |
| 100–110 (chưa đủ bucket) | 44 | 12,10 | 54,04 |

## Kiểm chứng cục bộ

- React thật: 649 và 1.001 dòng, 30 cập nhật partial không render lại history; append chỉ render dòng mới; mode/cỡ chữ vẫn cập nhật mọi dòng. Tạm bỏ memo khiến test thất bại: 20.119 lượt render thay vì 649.
- Preview Chrome dùng nguyên CaptionsPage và CSS repo, fake backend ngoài repo: bắt đầu 1.001 dòng, partial mỗi 100ms trong 60s, thêm final mỗi 3s. Kết thúc 1.021 dòng; đọc lùi scrollTop 63000,5 giữ nguyên. Frame p50 16,7ms, p95 17,6ms, max 17,8ms; 0 frame >34ms, 0 long task. Đây là fixture desktop, không thay cho live 60 phút hoặc kiểm chứng mọi thiết bị.
- Không thêm windowing vì chưa thấy giật sau memo ở fixture >1.000 dòng.
- Partial không tự ẩn sau 15s để không biến mất khi Gateway retry. Chỉ xóa partial cũ sau insert thành công; cutoff `updated_at <= received_at` giữ partial của segment mới. Cleanup transient retry tối đa hai lần mỗi insert, và lần insert sau vẫn retry nếu chưa thành công.
- Backend tests kiểm tra worker tối đa 4, hoàn tất dịch đảo thứ tự vẫn insert đúng thứ tự, replay/mixed duplicate không dịch lại và vẫn giữ previous-source context, dịch lỗi vẫn lưu nguồn, playback/đọc playback lỗi chặn insert, insert lỗi/duplicate không xóa partial, metrics và cleanup retry.

## Đo sau triển khai — còn bắt buộc

1. Review/push branch, triển khai đúng bản sửa `angel-caption` bằng workflow Lovable và frontend đúng commit. Không chạy migration. Ghi thời điểm triển khai MYT, commit và public code; phần dữ liệu trước triển khai phải tách khỏi phần sau triển khai. Nếu dùng phiên đang chạy, tiếp tục đọc liên tục >=60 phút sau triển khai; một phiên mới >=60 phút giúp có bucket 0–60 hoàn chỉnh trên cùng bản sửa.
2. Chạy từ root repo:

```sh
bun scripts/measure-caption-latency.ts PUBLIC_CODE after-deployment
```

Công thức đúng theo yêu cầu: `(created_at - started_at)/1000 - ts_offset_sec`. Bucket nguồn `floor(ts_offset_sec/600)*10`. Nhịp lấy chênh created_at giữa hai dòng liên tiếp theo seq; mẫu đầu/cuối 100 dòng dùng 99 khoảng nội bộ. Không trộn thời gian nhận ở trình duyệt vào phép đo. Snapshot đang live có bucket cuối chưa hoàn chỉnh; phải đợi đủ nguồn >=60 phút và lấy snapshot cuối để tránh kết luận từ dữ liệu còn thiếu.
3. Log mỗi segment `transcript_segment_complete`: `sentence_count`, `received_at`, `last_insert_ms` (received → insert thành công cuối), `processing_ms` (toàn handler), `translation_median_ms` (chỉ các câu thực sự dịch, null khi replay toàn bộ), `inserted_count`. Log vẫn chạy khi insert/playback chặn sớm; số insert thấp không được coi là thành công đủ segment. Không ghi transcript hoặc secret.
4. Theo từng bucket 10 phút, đối chiếu trung vị trễ đầu/cuối và sau phút 50; phải giữ phẳng, nhịp cuối không tăng gấp đôi. Giữ cả số mẫu/max và log Gateway để không che outlier. Phần >=60 phút sau deploy trong cùng phiên cũ không phải phép đo 60 phút đầu của bản sửa.
5. Trên live >=600 dòng, cuộn đọc dòng cũ trong lúc partial cập nhật, ghi frame/long-task và vị trí cuộn; kiểm tra desktop/mobile. Chỉ thêm windowing nếu còn giật >1.000 dòng.
6. Đối chiếu Recall final segments với dedupe_key/số câu và log insert để phát hiện mất dòng; kiểm tra seq tăng đúng thứ tự và không trùng. Seq liên tục tự nó không chứng minh không mất lời nói. Kết thúc phiên theo quy trình vận hành rồi xác minh summary tạo/giao đúng một lần và nội dung bao phủ phiên.

## Kết quả lệnh

- Frontend: `bun test src`: **59 pass, 0 fail** (14 file). Riêng CaptionsPage: 11 pass.
- Edge Function: `deno test --no-lock --node-modules-dir=none --allow-read --allow-env supabase/functions/angel-caption`: **76 pass, 0 fail**, bao gồm lifecycle và summary tests.
- `bun run build`: thành công; có cảnh báo chunk lớn có sẵn. File version tự sinh đã khôi phục, không commit.
- Lint scoped CaptionsPage + measurement script: 0 error, 1 cảnh báo Fast Refresh ở helper `captionSubFontSize` đã tồn tại.
- `git diff --check`: không lỗi whitespace.
- `bun test` toàn repo: **62 pass, 65 fail/error** vì Bun nạp Deno tests (`npm:` imports/Deno globals), gồm `supabase/functions/angel-caption/lifecycle_test.ts`, `supabase/functions/telegram-community-webhook/group-vision_test.ts`, `supabase/functions/_shared/telegram-moderation-integration.test.ts`. Full log local: `/tmp/caption-bun-tests.log`. Không báo toàn repo pass.
- `deno check` entrypoint: **5 lỗi**; đối chiếu bản HEAD trước sửa bằng entrypoint tạm cho đúng 5 lỗi đó: FlagKey `router.strict_mirror`, `group.per_user_history`, `factual.include_user_context`; hai khai báo `Response` cho kết quả `recallFetch` ở playback start/stop. Không sửa lỗi ngoài phạm vi. Log local: `/tmp/caption-deno-check.log`, `/tmp/caption-baseline-check.log`.
- Deno lock hiện có registry origin không khớp npmjs; dùng `--no-lock --node-modules-dir=none` để kiểm thử bằng Deno cache, không thay lockfile.
- Review độc lập phát hiện cleanup lỗi tạm thời; đã bổ sung test RED→GREEN và retry có giới hạn, rồi chạy lại toàn bộ 76 Edge tests. Không có finding Critical/Minor khác.

**Chưa nghiệm thu:** >=60 phút live trên bản đã deploy, frame-time live/mobile, đối chiếu không mất lời nói với Recall và summary phiên thật. Không merge main trước các bước còn lại.
