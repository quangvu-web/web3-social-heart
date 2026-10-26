# Nghiệm thu tóm tắt toàn phiên

Ngày 26/10/2026, Malaysia Time (UTC+8). Branch `feature/caption-summary-map-reduce`. Không chạy migration, không thay Telegram formatter, đường nhóm/DM, thời lượng, auth hoặc dữ liệu phiên.

## Dữ liệu thật đã kiểm tra

Đọc public caption API cho `jc8aa6fq3z89`: trạng thái ended; 93,0109 phút; 600 dòng; transcript đúng định dạng hiện hành dài **61.867 ký tự**. Bản cũ đọc trọn 233 dòng tới phút 28,0021 rồi cắt ngang phần còn lại. Thu Huyền xuất hiện lần đầu dòng 295. Metadata chi tiết: `caption-summary-jc8aa6fq3z89-baseline.json`; transcript đầy đủ chỉ lưu tạm ngoài repo, không đưa vào git/log.

| Chunk | Dòng đầu–cuối | Ký tự |
|---|---:|---:|
| 1 | 1–68 | 7.951 |
| 2 | 69–142 | 7.983 |
| 3 | 143–233 | 7.758 |
| 4 | 234–291 | 7.550 |
| 5 | 292–389 | 7.992 |
| 6 | 390–482 | 7.926 |
| 7 | 483–557 | 7.948 |
| 8 | 558–600 | 6.752 |

Chạy dry-run **hàm production** trên transcript thật với Gateway giả: tất cả 600 dòng được nối lại đúng từng ký tự qua 8 map request; reduce nhận đủ 8 notes theo thứ tự. Tổng 9 call logic. Đây chỉ là kiểm chứng chuyển đủ dữ liệu, **không phải** nghiệm thu chất lượng AI thật hoặc bằng chứng gửi Telegram.

## Cách hoạt động và giới hạn

- Transcript <=24.000 ký tự giữ nguyên model, prompt, nhiệt độ, timeout/retry và một lần gọi hiện hành. Chỉ phiên dài dùng map-reduce.
- Chunk theo nguyên dòng có tên người nói/nguồn/bản English như trước; mục tiêu <=8.000 ký tự tính cả newline. Nếu một dòng tự nó dài hơn 8.000, giữ nguyên dòng đó thành một chunk riêng, có `max_chunk_chars` trong log; không cắt hay bỏ lời nói. Fixture thật không có ngoại lệ này.
- Tối đa 3 map call đồng thời. Notes map dùng JSON Schema: main_points, qa, speakers, source_titles, session_stages và các nhóm meditation/presentations/music_dance/mc_audience/other_activities (mọi trường là mảng chuỗi). Reduce nhận toàn bộ notes, danh mục chặng, tên bài và nhóm hoạt động theo thứ tự; không còn giới hạn 3–7 ý cho phiên dài. Mỗi nhóm có dữ liệu phải được phản ánh trong điểm chính, giữ cả chặng ngắn và vai trò MC đọc tin, phân biệt âm nhạc với lời giảng. Short path giữ nguyên prompt cũ.
- Map/reduce dài lỗi, trống hoặc bị provider cắt (`finish_reason=length`) thì không xuất bản bản tóm tắt thiếu. Short path giữ xử lý response hiện có.
- runSummarize đọc các trang 1.000 dòng, thứ tự `seq,id`; lỗi trang sau thì dừng trước AI/gửi thay vì gửi chỉ phần đầu. Test đã chứng minh với 1.205 dòng.
- Log một dòng `summary_pipeline`: session_id, mode, line_count, transcript_chars, chunk_count, max_chunk_chars, ai_call_count, planned_ai_call_count, gateway_max_attempts_per_call, status. `ai_call_count` đếm **callAiGateway logic**, không giả vờ đếm request retry upstream. Mỗi call vẫn tối đa 2 attempts như trước; 8 chunk => 9 logical calls, tối đa 18 attempts. Log thêm `activity_counts` và `summary_chars`; không log transcript/notes/bản tóm tắt/secret.
- Giữ đúng bốn mục song ngữ; formatter cũ đổi bullet sang • và Markdown bold sang HTML thật. Không sửa cách gửi một message hiện có. Reduce dùng object ngôn ngữ `vi/en` (Q&A dùng question/answer theo ngôn ngữ); ứng dụng dựng đúng bốn mục, mỗi nhóm hoạt động đã được map phải có đủ hai ngôn ngữ. Chỉ tên bài được đối chiếu với `text_source` mới được dùng làm bằng chứng; bản dịch không chứng minh số Paper. Output dài hơn 3.500 ký tự bị từ chối, không cắt mất chặng hay gọi thêm AI nén.

## Kiểm thử

- Edge Function: **93 pass, 0 fail** bằng `CAPTION_SUMMARY_FIXTURE_PATH=/tmp/caption-summary-jc8aa6fq3z89-source.json deno test --no-lock --node-modules-dir=none --allow-read --allow-env supabase/functions/angel-caption`. Có cả test delivery/formatter/lifecycle hiện hành và dry-run thật (Gateway giả).
- Frontend: `bun test src`: **59 pass, 0 fail**. `bun run build`: thành công, file version tự sinh đã khôi phục.
- `bun test` tại root: **62 pass, 67 fail/error** vì runner Bun nạp Deno tests với `npm:`/Deno globals; không báo toàn repo pass. Log local `/tmp/caption-summary-bun-root.log` (gồm các file summary mới).
- `deno check` entrypoint có **5 lỗi có sẵn**, tái hiện cùng 5 lỗi bằng bản HEAD trước sửa: FlagKey `router.strict_mirror`, `group.per_user_history`, `factual.include_user_context`; hai kiểu Response của recallFetch trong playback. Log local `/tmp/caption-summary-final-check.log`, `/tmp/caption-summary-prechange-check.log`. Không sửa lỗi ngoài phạm vi.
- Review độc lập đã phát hiện nguy cơ dùng bản dịch làm bằng chứng số Paper; đã bổ sung regression test và sửa chỉ dùng lời gốc. Nghiệm thu runtime được ghi riêng bên dưới.
- `git diff --check`: không lỗi whitespace.

Tests mới gồm threshold 23.999/24.000/24.001, nối lại toàn bộ dòng, dòng đơn quá dài, worker<=3/hoàn tất đảo thứ tự, lỗi/trống/truncated map, reduce lỗi, đuôi >1.000 dòng, lỗi trang sau, short envelope/thời lượng/formatter.

Có thể chạy lại dry-run với file JSON local có dạng `{ "rows": [...] }` (đúng transcript jc8aa6fq3z89) mà không dùng khóa AI:

```sh
CAPTION_SUMMARY_FIXTURE_PATH=/path/to/export.json deno test --no-lock --node-modules-dir=none --allow-read --allow-env supabase/functions/angel-caption/summary-pipeline_test.ts
```

File fixture không được commit. Test mang tên `real session dry run ... (not AI content acceptance)` sẽ ignored nếu không có biến đường dẫn, không bị tính là pass.

## Nghiệm thu production

Đã triển khai riêng `angel-caption` bằng CLI đang đăng nhập đúng backend managed production. Chạy qua lệnh vận hành có sẵn `/caption_resend PUBLIC_CODE` trong bot `@funrich_community_bot`, có operator guard hiện hành. Không đổi auth, không đọc secret, không chạy migration. Mọi thời điểm dưới đây là MYT (UTC+8).

### Các lượt trung gian chưa đạt

- 17:58 và 18:03: đủ 8 map + 1 reduce, giao nhóm/DM nhưng thiếu một số chặng, không đạt (a).
- 18:08 và 18:12: map JSON sai schema, dừng sau 3 call, không reduce/gửi bản thiếu. Sau đó chuyển JSON Schema + parser kiểm tra.
- 18:16: giao được nhưng thiếu vai MC; chuyển notes sang nhóm hoạt động riêng.
- 18:23: pipeline xong nhưng Telegram từ chối quá dài; không coi `summary_finished` là bằng chứng giao.
- 18:33: có output nhưng sai Paper140; không đạt. Đã thêm kiểm chứng số Paper chỉ bằng lời gốc, kể cả nhãn tiếng Việt Bài165; bản dịch không được dùng làm bằng chứng.
- 20:59: message266676 có các nhóm hoạt động nhưng một trường English còn tiếng Việt. Đã chuyển reduce từ mảng sang object ngôn ngữ có tên trường rõ.
- 21:17: version31 từ commit810f3d9 có 8 chunk/9 call, output3916 ký tự vượt3500; hệ thống dừng gửi. Bản kế tiếp siết câu ngắn theo ngân sách từng trường, giữ nguyên các nhóm và không thêm call nén.

### (a) Phiên jc8aa6fq3z89

Bản cuối commit `bd5663d`: pipeline21:18:57 completed,600 dòng/61.867 ký tự,8 chunk/9 call, output2.934 ký tự. DM message **266684**,21:18, có footer xác nhận đăng nhóm;9 phần bold thật và bốn mục song ngữ. Đối chiếu nội dung đã gửi:

| Nội dung bắt buộc | Bằng chứng trong bản mới |
|---|---|
| Thiền mở đầu, Urantia Paper165 | Có dòng bài đọc Paper165/The Urantia Book và Angel Hoài Ann hướng dẫn trẻ em thiền/biết ơn |
| Jesus tin tưởng/của cải | Có tin tưởng, tránh tham lam, quản lý tài sản ưu tiên tâm linh |
| Thu Huyền thuyết trình | Nêu đúng tên và chủ đề LoveHub |
| Trẻ em nghe nhạc/nhảy | English ghi children listened to light music; có cộng đồng nhảy cùng nhau (trẻ em nằm trong cộng đồng), không biến bài hát thành lời giảng |
| MC đọc lời chúc/tương tác | Hoài Ann đọc lời chúc/phần thưởng và tương tác, kêu gọi khán giả gửi năng lượng |

Nội dung (a) đã xuất hiện trong AI thật, không chèn năm ý từ fixture. Giới hạn chất lượng còn thấy: response vẫn lặp vài ý và tự đưa Jesus (nhân vật trong bài đọc) vào nhóm thuyết trình dù prompt đã phân biệt; bản Việt gọi nhạc nhẹ, bản English là light music. Không khẳng định transcript nhận diện mọi tên/tiêu đề hoàn hảo.

### (b) Phiên a3mgge629vpf do người dùng chọn

Nguồn public xác nhận ended, 783 dòng,113.132 ký tự,123,567 phút; 15 chunk =>16 call. Đây là phiên ghi trước deploy được người dùng chọn chạy tóm tắt lại, **không phải** một phiên mới ghi sau deploy.

Lần18:24:51 pipeline completed,18:24:53 giao nhóm/DM; message266642 dài3686 ký tự hiển thị,9 thẻ bold. Có nội dung cuối: cảm ơn nhóm hỗ trợ, chia sẻ về con lắc, mời đọc tin nhắn nhóm và lịch sinh hoạt. Đây là bằng chứng bản trung gian giữ đuôi; cần đối chiếu lại bản cuối. Lượt21:19 trên code cuối bị Gateway429 sau6 call map, chưa reduce, không gửi bản thiếu. Lần thử lại21:20:42 cũng failed sau15 call map vì Gateway429, không reduce/gửi. Đây là lỗi giới hạn dịch vụ lặp lại; chưa đạt nghiệm thu bản cuối. Không tiếp tục tạo thêm các lượt tốn phí trong đợt này.

10 phút cuối tính đúng `duration_sec - 600 = 6814,028`:11 dòng773–783. Nội dung có nhạc/Minh Quân, kiểm tra Zoom/chụp ảnh với Thùy Trâm, cảm ơn bài trình bày và con lắc/vũ trụ, mời đọc tin nhắn, nhắc lịch. Không cần mọi câu xuất hiện nhưng chủ đề cuối phải có trong bản tóm tắt.

### (c) Phiên ngắn

Phiên `4at49yfkkbxw`:2 dòng,430 ký tự,6,99045 phút.18:13:27 log `mode=single`, `ai_call_count=1`, completed;18:13:29 summary_finished. DM message266627 nhận1171 ký tự, đủ bốn mục song ngữ và bullet, footer báo đăng nhóm thành công, thời lượng~7 phút. Header bold thật; các heading mục của response ngắn này là plain text giống response ngắn cũ. Giữ nguyên prompt/formatter/path short, không sửa ngoài yêu cầu để ép kiểu chữ model.

### Bằng chứng và chi phí

Transcript thô và bản export tạm giữ ngoài repo. Metadata baseline đã commit không chứa secret. Log đếm logical call, không phải tổng attempt retry. Mỗi lượt nghiệm thu dài cũng phát sinh chi phí riêng: jc9call/lượt hoàn tất; a3 16call/lượt; short1call. Các lượt lỗi có count thực tế như log ở trên. Không suy luận thành công gửi từ pipeline completed: phải có output DM mới và footer nhóm thành công (footer chỉ được thêm sau Telegram group API thành công theo helper hiện hành).
