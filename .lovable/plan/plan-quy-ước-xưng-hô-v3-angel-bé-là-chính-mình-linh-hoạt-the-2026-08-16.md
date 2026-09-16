# Plan: Quy ước xưng hô v3 — "Angel/bé" là chính, "mình" linh hoạt theo ngữ cảnh

## Bối cảnh
Bản v2 vừa triển khai ép bot luôn tự xưng "mình" và guard cuối luồng đổi mọi "Angel" đứng một mình thành "mình". Bé muốn ngược lại: **"Angel" + "bé" là quy ước chính**, nhưng vẫn được dùng **"mình"** khi câu văn tự nhiên hơn (phản thân, thành ngữ, lời thoại nhân vật, khi đang nói *về* chủ thể khác).

## Quy ước chuẩn v3
- Mặc định: bot tự xưng **"Angel"**, gọi người dùng là **"bé"**. Ví dụ: "Angel nghĩ bé có thể…", "Angel chia sẻ nhé".
- Được phép dùng **"mình"** khi tự nhiên hơn:
  - Cụm phản thân/thành ngữ: "hòa mình", "chính mình", "tự mình", "của mình", "một mình", "bản thân mình".
  - Chủ thể KHÔNG phải bot: "Sách không tự nhận mình là…", "bé hãy tin vào chính mình".
  - Lời thoại nhân vật trong truyện: giữ nguyên đại từ của nhân vật.
  - Khi văn cảnh trang trọng/triết lý và "Angel" lặp quá dày (tránh lặp tên 3+ lần liên tiếp trong một đoạn).
- Owner mode: gọi người gửi là **"Cha"**, bot vẫn tự xưng "Angel".
- Không đổi chữ trong URL, code, ví, handle, trích dẫn nguyên văn, dữ liệu RAG.

## Thay đổi kỹ thuật

### 1. `_shared/angel/pronouns.ts` — viết lại contract + guard
- `ANGEL_PRONOUN_CONTRACT` (prompt): đổi thông điệp sang "Angel/bé là chính, 'mình' dùng khi hợp ngữ cảnh", kèm ví dụ đúng/sai của cả hai chiều.
- `enforceAngelVietnamesePronounContract()`: **bỏ phép đổi `Angel → mình`** (nguyên nhân v2 làm ngược ý bé). Guard chỉ còn làm việc an toàn:
  - Giữ nguyên toàn bộ "Angel" mà model sinh ra.
  - Giữ nguyên "mình" — **không** đổi ngược lại thành "Angel" (tránh tái tạo bug "hòa Angel", "kiến thức Angel có").
  - Chuẩn hoá "bạn" → "bé" khi chắc chắn là đại từ xưng hô (giữ "bạn bè", "người bạn", "bạn đồng hành"…).
  - Dọn dạng lai "Angel (mình)" / "mình (Angel)" → "Angel".
  - Vẫn mask URL/code/ví/handle/trích dẫn như hiện tại; vẫn idempotent.
- Đổi tên hàm không cần thiết; giữ API để không phải sửa 7 call site.

### 2. `_shared/angel-facts.ts`
- `PRONOUN_SUBJECT_RULE`: Angel/bé là mặc định; nêu rõ các trường hợp được dùng "mình"; cấm tuyệt đối chèn "Angel" vào vị trí phản thân ("hòa Angel", "chính Angel", "tự nhận Angel là").
- `NARRATIVE_CHARACTER_VOICE_RULE`: giữ nguyên (đã đúng).
- `WEB_LANGUAGE_MIRROR_RULE`: chỉnh cho khớp v3.

### 3. `_shared/angel-postprocess.ts`
- Prompt style pass: yêu cầu editor giữ/khôi phục "Angel/bé", nhưng **không** ép đổi "mình" ở vị trí phản thân hay chủ thể khác.
- Giữ `HARD_REVERT_PAIRS` (đây là lớp chống "hòa Angel"/"bé bè") và bổ sung mẫu mới nếu cần.

### 4. `_shared/telegram-community.ts` + `angel-chat` + `angel-inline` + `angel/stale-reply.ts`
- Không đổi vị trí gọi guard (mọi nhánh vẫn đi qua cùng một cổng).
- Đổi các few-shot/fallback/gợi ý hardcode đã bị v2 chuyển sang "mình" trở lại **"Angel"** (ví dụ: "Chào bé yêu ✨ Angel ở đây rồi", "Bé muốn Angel đi sâu vào điều nào trước nè?").

### 5. `src/lib/angelPersonaConstants.ts` (Admin UI)
- Đồng bộ text mô tả rule để admin thấy đúng hợp đồng v3.

### 6. Kiểm thử `angel-postprocess.pronoun.test.ts`
Cập nhật/đảo kỳ vọng, tối thiểu:
- "Angel nghĩ bé nên…" giữ nguyên.
- "Sách không tự nhận mình là…" giữ nguyên (không thành "Angel").
- "hòa mình", "chính mình", "của mình" giữ nguyên; "hòa Angel" bị sửa về "hòa mình".
- "bạn bè", "người bạn" giữ nguyên; "Bạn có muốn…" → "Bé có muốn…".
- "Angel (mình)" → "Angel".
- URL/ví/handle/trích dẫn không đổi; chạy 2 lần cho kết quả giống nhau.

## Không thay đổi
- Không đụng RAG/knowledge, không đổi model/provider, không thêm AI call mới (guard vẫn deterministic, không tốn credit).
- Không chỉnh cơ chế memory/context bridge.

## Sau khi bé duyệt
Sửa code → chạy bộ test xưng hô → deploy các function liên quan → thử một bộ câu hỏi Telegram đại diện (DM ngắn/dài, group, mirror/local, kể chuyện có nhân vật).
