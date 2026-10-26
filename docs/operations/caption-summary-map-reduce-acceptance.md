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
- Tối đa 3 map call đồng thời. Notes gọn ghi ý chính, Q&A và danh tính nếu xác định được, người nói, hoạt động; phân biệt phần âm nhạc với lời giảng và lời MC. Reduce nhận notes theo thứ tự và được yêu cầu giữ mọi chặng lớn, kể cả ngắn; giới hạn 3–7 ý nhường chỗ cho đủ chặng khi cần.
- Map/reduce dài lỗi, trống hoặc bị provider cắt (`finish_reason=length`) thì không xuất bản bản tóm tắt thiếu. Short path giữ xử lý response hiện có.
- runSummarize đọc các trang 1.000 dòng, thứ tự `seq,id`; lỗi trang sau thì dừng trước AI/gửi thay vì gửi chỉ phần đầu. Test đã chứng minh với 1.205 dòng.
- Log một dòng `summary_pipeline`: session_id, mode, line_count, transcript_chars, chunk_count, max_chunk_chars, ai_call_count, planned_ai_call_count, gateway_max_attempts_per_call, status. `ai_call_count` đếm **callAiGateway logic**, không giả vờ đếm request retry upstream. Mỗi call vẫn tối đa 2 attempts như trước; 8 chunk => 9 logical calls, tối đa 18 attempts. Không log transcript/notes/bản tóm tắt/secret.
- Giữ đúng bốn mục song ngữ; formatter cũ đổi bullet sang • và Markdown bold sang HTML thật. Không sửa cách gửi một message hiện có. Nghiệm thu thật phải kiểm tra độ dài Telegram chấp nhận và thời gian worker khi map nhiều lượt; chưa có số đo để khẳng định.

## Kiểm thử

- Edge Function: **87 pass, 0 fail** bằng `CAPTION_SUMMARY_FIXTURE_PATH=/tmp/caption-summary-jc8aa6fq3z89-source.json deno test --no-lock --node-modules-dir=none --allow-read --allow-env supabase/functions/angel-caption`. Có cả test delivery/formatter/lifecycle hiện hành và dry-run thật (Gateway giả).
- Frontend: `bun test src`: **59 pass, 0 fail**. `bun run build`: thành công, file version tự sinh đã khôi phục.
- `bun test` tại root: **62 pass, 67 fail/error** vì runner Bun nạp Deno tests với `npm:`/Deno globals; không báo toàn repo pass. Log local `/tmp/caption-summary-bun-root.log` (gồm các file summary mới).
- `deno check` entrypoint có **5 lỗi có sẵn**, tái hiện cùng 5 lỗi bằng bản HEAD trước sửa: FlagKey `router.strict_mirror`, `group.per_user_history`, `factual.include_user_context`; hai kiểu Response của recallFetch trong playback. Log local `/tmp/caption-summary-deno-check.log`, `/tmp/caption-summary-prechange-check.log`. Không sửa lỗi ngoài phạm vi.
- Review độc lập: không có finding Critical/Important/Minor; chất lượng AI thật/thời gian worker/độ dài Telegram còn chờ nghiệm thu runtime.
- `git diff --check`: không lỗi whitespace.

Tests mới gồm threshold 23.999/24.000/24.001, nối lại toàn bộ dòng, dòng đơn quá dài, worker<=3/hoàn tất đảo thứ tự, lỗi/trống/truncated map, reduce lỗi, đuôi >1.000 dòng, lỗi trang sau, short envelope/thời lượng/formatter.

Có thể chạy lại dry-run với file JSON local có dạng `{ "rows": [...] }` (đúng transcript jc8aa6fq3z89) mà không dùng khóa AI:

```sh
CAPTION_SUMMARY_FIXTURE_PATH=/path/to/export.json deno test --no-lock --node-modules-dir=none --allow-read --allow-env supabase/functions/angel-caption/summary-pipeline_test.ts
```

File fixture không được commit. Test mang tên `real session dry run ... (not AI content acceptance)` sẽ ignored nếu không có biến đường dẫn, không bị tính là pass.

## Nghiệm thu production còn bắt buộc

Môi trường local không có `LOVABLE_API_KEY` hoặc `CAPTION_INTERNAL_TOKEN`. Chưa deploy hoặc gọi endpoint summarize production; không thay/bỏ auth và không đưa secret vào file/chat/log để ép chạy. Sau khi runtime qua Lovable triển khai đúng bản sửa, thực hiện qua môi trường nội bộ được cấp quyền:

(a) Gọi route hiện có `POST /functions/v1/angel-caption?action=summarize`, header nội bộ như trước, body `{ "public_code": "jc8aa6fq3z89" }`. Đây là yêu cầu chạy lại đã được người dùng cho phép; giữ nguyên nhóm + DM. Đọc bản AI thật trong nhóm/DM, bắt buộc đủ:

- Thiền mở đầu theo Urantia Book Paper 165.
- Jesus giảng về tin tưởng/của cải.
- Bài thuyết trình có nêu tên bé Thu Huyền.
- Các em bé nghe nhạc ánh sáng và nhảy cùng nhau cuối buổi.
- MC đọc tin nhắn chúc mừng và trò chuyện khán giả.

Không tự chèn năm ý vào kết quả hay dùng câu trả lời mock làm chứng cứ. Lưu thời điểm MYT, commit triển khai, log 8 map + 1 reduce, thời gian xử lý thực, output song ngữ và bằng chứng gửi nhóm/DM. Nếu bất kỳ ý nào thiếu, chưa đạt (a).

(b) Một phiên dài mới >=60 phút chạy trên bản sửa: ghi public code, đối chiếu transcript 10 phút đầu/cuối với output; chủ đề cuối phải hiện trong summary. Kiểm tra riêng thời gian worker và Telegram chấp nhận toàn bản, không bị cắt/mất ở khâu giao.

(c) Một phiên ngắn <=24.000 ký tự trên production: log mode=single/ai_call_count=1 và xác nhận bốn mục/bullet •/bold thật/song ngữ/nhóm+DM/thời lượng vẫn đúng. Unit/integration tests đã phủ hợp đồng này nhưng chưa thay thế kiểm tra production.
