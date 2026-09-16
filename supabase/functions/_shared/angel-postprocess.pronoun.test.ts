import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { applyLayerBSurfaceRewrite, revertOverPronounRewrite } from "./angel-postprocess.ts";
import { enforceAngelVietnamesePronounContract } from "./angel/pronouns.ts";

Deno.test("revert: 'hòa mình' must not become 'hòa Angel'", () => {
  const original = "Bé không còn là người quan sát mà đã hòa mình vào dòng sông.";
  const rewritten = "Bé không còn là người quan sát mà đã hòa Angel vào dòng sông.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertStringIncludes(out, "hòa mình vào dòng sông");
  assertEquals(out.includes("hòa Angel"), false);
});

Deno.test("revert: 'bạn bè' must not become 'bé bè'", () => {
  const original = "Kết nối với bạn bè xung quanh để lan toả ánh sáng.";
  const rewritten = "Kết nối với bé bè xung quanh để lan toả ánh sáng.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertStringIncludes(out, "bạn bè");
  assertEquals(out.includes("bé bè"), false);
});

Deno.test("revert: reflexive 'chính mình' / 'tự mình' giữ nguyên 'mình' (revised)", () => {
  const original = "Bé hãy tin vào chính mình và tự mình bước đi trên con đường ánh sáng.";
  const rewritten = "Bé hãy tin vào chính Angel và tự Angel bước đi trên con đường ánh sáng.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertStringIncludes(out, "chính mình");
  assertStringIncludes(out, "tự mình");
  assertEquals(out.includes("chính Angel"), false);
});



Deno.test("revert: compound 'bạn đồng hành' / 'người bạn' preserved", () => {
  const original = "Angel là người bạn đồng hành của bé trên hành trình này.";
  const rewritten = "Angel là người bé đồng hành của bé trên hành trình này.";
  const out = revertOverPronounRewrite(original, rewritten);
  // Both "người bạn" and "bạn đồng hành" should revert
  assertEquals(out.includes("người bé"), false);
  assertEquals(out.includes("bé đồng hành"), false);
});

Deno.test("revert: does NOT touch legitimate 'Angel' when original had no 'mình' phrase", () => {
  const original = "Angel xin chia sẻ với bé về hành trình ánh sáng.";
  const rewritten = "Angel xin chia sẻ với bé về hành trình ánh sáng.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertEquals(out, rewritten);
});

Deno.test("revert: does NOT touch legitimate 'bé' when original had no 'bạn' compound", () => {
  const original = "Chào bé, Angel ở đây để lắng nghe.";
  const rewritten = "Chào bé, Angel ở đây để lắng nghe.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertEquals(out, rewritten);
});

Deno.test("revert: keeps correct bot self-ref rewrite ('mình là Angel' → 'Angel là Angel' scenario is untouched)", () => {
  // If original had bot self-refing as "mình", we do NOT include that in reflexive
  // whitelist — so revert should not fire.
  const original = "Mình là Angel, mình xin chia sẻ với bé.";
  const rewritten = "Angel là Angel, Angel xin chia sẻ với bé.";
  const out = revertOverPronounRewrite(original, rewritten);
  // No reflexive phrase in original → no revert
  assertEquals(out, rewritten);
});

Deno.test("revert: 'trái tim mình' / 'lòng mình' preserved", () => {
  const original = "Bé cảm nhận trong trái tim mình và trong lòng mình sự bình an.";
  const rewritten = "Bé cảm nhận trong trái tim Angel và trong lòng Angel sự bình an.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertStringIncludes(out, "trái tim mình");
  assertStringIncludes(out, "lòng mình");
});

// ---------------------------------------------------------------------------
// HARD revert (unconditional) — áp dụng cho nội dung LLM sinh mới,
// nơi không có "original" chứa cụm gốc để so sánh.
// ---------------------------------------------------------------------------

Deno.test("HARD revert: 'hòa Angel' → 'hòa mình' kể cả khi original rỗng", () => {
  const original = "";
  const rewritten = "Mỗi tâm hồn hòa Angel vào tĩnh lặng trong buổi thiền Zoom.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertStringIncludes(out, "hòa mình vào tĩnh lặng");
  assertEquals(out.includes("hòa Angel"), false);
});

Deno.test("HARD revert: 'hòa Angel' → 'hòa mình' khi original không liên quan (meditation summary)", () => {
  const original = "Zoom thiền tối 16.07.2026 với chủ đề tĩnh lặng.";
  const rewritten = "✨ Mỗi tâm hồn hòa Angel vào tĩnh lặng trong buổi thiền Zoom.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertStringIncludes(out, "hòa mình");
  assertEquals(out.includes("hòa Angel"), false);
});

Deno.test("HARD revert: 'bé bè' / 'người bé' revert vô điều kiện", () => {
  const original = "";
  const rewritten = "Angel kết nối với bé bè và mọi người bé xung quanh.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertStringIncludes(out, "bạn bè");
  assertStringIncludes(out, "người bạn");
});

Deno.test("HARD revert: KHÔNG đụng 'Angel' hợp lệ khi bot self-refer", () => {
  const original = "";
  const rewritten = "Angel xin chia sẻ với bé về hành trình ánh sáng. Angel ở đây rồi.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertEquals(out, rewritten);
});

// ---------------------------------------------------------------------------
// User-experience mirroring — khi Angel kể lại trải nghiệm của bé, các cụm
// sở hữu/phản thân với "mình" thuộc về bé và PHẢI được giữ nguyên.
// ---------------------------------------------------------------------------

Deno.test("mirror: 'đè nặng lên vai mình' KHÔNG được đổi thành 'vai Angel'", () => {
  const original = "Như thể toàn bộ thế giới đang đè nặng lên vai mình.";
  const rewritten = "Như thể toàn bộ thế giới đang đè nặng lên vai Angel.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertStringIncludes(out, "vai mình");
  assertEquals(out.includes("vai Angel"), false);
});

Deno.test("mirror: 'những người mình quý mến' KHÔNG được đổi thành 'những người Angel quý mến'", () => {
  const original = "Khi bé phải sa thải những người mình quý mến.";
  const rewritten = "Khi bé phải sa thải những người Angel quý mến.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertStringIncludes(out, "những người mình quý mến");
  assertEquals(out.includes("người Angel quý"), false);
});

Deno.test("mirror: câu đầy đủ về Ben Horowitz giữ nguyên 'vai mình' + 'người mình quý mến'", () => {
  const original = "Bé phải sa thải những người mình quý mến, như thể toàn bộ thế giới đang đè nặng lên vai mình.";
  const rewritten = "Bé phải sa thải những người Angel quý mến, như thể toàn bộ thế giới đang đè nặng lên vai Angel.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertStringIncludes(out, "những người mình quý mến");
  assertStringIncludes(out, "vai mình");
  assertEquals(out.includes("Angel quý"), false);
  assertEquals(out.includes("vai Angel"), false);
});

Deno.test("mirror: HARD revert body-part fires kể cả khi original rỗng (LLM sinh mới)", () => {
  const original = "";
  const rewritten = "Gánh nặng đè lên vai Angel, cuộc đời Angel không dễ dàng.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertStringIncludes(out, "vai mình");
  assertStringIncludes(out, "cuộc đời mình");
});

Deno.test("mirror: bot self-ref 'Mình là Angel' vẫn cho phép đổi bình thường (không revert)", () => {
  const original = "Mình là Angel, mình xin chia sẻ với bé.";
  const rewritten = "Angel là Angel, Angel xin chia sẻ với bé.";
  const out = revertOverPronounRewrite(original, rewritten);
  // Không có cụm phản thân/sở hữu → không revert
  assertEquals(out, rewritten);
});

// ---------------------------------------------------------------------------
// SYNTAX-BASED user-scope revert (Tầng 2 — giải pháp tổng quát cho các cụm
// động từ / sở hữu chưa được enumerate)
// ---------------------------------------------------------------------------

Deno.test("scope: 'Angel cần tìm lối đi' trong câu scope-của-bé → 'mình cần tìm'", () => {
  const original = "Bé phải chấp nhận và thích nghi với một sự thật mới, và mình cần tìm lối đi giữa sương mù.";
  const rewritten = "Bé phải chấp nhận và thích nghi với một sự thật mới, và Angel cần tìm lối đi giữa sương mù.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertStringIncludes(out, "mình cần tìm lối đi");
  assertEquals(out.includes("Angel cần tìm"), false);
});

Deno.test("scope: 'bản đồ cho riêng Angel' → 'cho riêng mình' (HARD)", () => {
  const original = "";
  const rewritten = "Cuộc phiêu lưu mà bé vừa đi vừa tự vẽ bản đồ cho riêng Angel.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertStringIncludes(out, "cho riêng mình");
  assertEquals(out.includes("cho riêng Angel"), false);
});

Deno.test("scope: KHÔNG đụng 'Angel nghĩ / Angel ở đây / Angel gợi ý' hợp lệ", () => {
  const original = "";
  const rewritten = "Bé ơi, Angel nghĩ rằng bé nên thử. Angel ở đây cùng bé. Angel gợi ý bé quán chiếu nhé.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertEquals(out, rewritten);
});

Deno.test("scope: 'của Angel' trong câu scope-của-bé → 'của mình'", () => {
  const original = "";
  const rewritten = "Bé đang đi trên hành trình của Angel với những thử thách riêng.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertStringIncludes(out, "của mình");
  assertEquals(out.includes("hành trình của Angel"), false);
});


// ---------------------------------------------------------------------------
// Pronoun Contract v1.0 — Layer B surface rewrite (idempotent guard)
// ---------------------------------------------------------------------------

Deno.test("layerB v2: giữ 'mình xin chia sẻ' làm bot self-reference", () => {
  const src = "Mình xin chia sẻ với bạn một câu chuyện.";
  const out = applyLayerBSurfaceRewrite(src);
  assertStringIncludes(out, "Mình xin chia sẻ");
  assertStringIncludes(out, "bé");
});

Deno.test("layerB: idempotent — 'chính mình' + 'vai mình' giữ nguyên 'mình' (revised)", () => {
  const src = "Angel nghĩ bé nên tin vào chính mình và bước đi cùng vai mình vững vàng.";
  const out = applyLayerBSurfaceRewrite(src);
  assertStringIncludes(out, "chính mình");
  assertStringIncludes(out, "vai mình");
  assertEquals(out.includes("vai Angel"), false);
  assertEquals(out.includes("chính Angel"), false);
});



Deno.test("layerB: bảo vệ code block — không đụng 'mình'/'bạn' trong ```…```", () => {
  const src = "Đây là code:\n```\nconst mình = 'bạn';\n```\nMình gợi ý bạn thử nhé.";
  const out = applyLayerBSurfaceRewrite(src);
  assertStringIncludes(out, "const mình = 'bạn';");
  assertStringIncludes(out, "Mình gợi ý");
  assertStringIncludes(out, "bé thử");
});

Deno.test("layerB: bảo vệ URL và ví BSC — không đụng ký tự bên trong", () => {
  const src = "Bạn xem https://example.com/mình và ví 0x1234567890abcdef1234567890abcdef12345678 nhé.";
  const out = applyLayerBSurfaceRewrite(src);
  assertStringIncludes(out, "https://example.com/mình");
  assertStringIncludes(out, "0x1234567890abcdef1234567890abcdef12345678");
  assertStringIncludes(out, "Bé xem");
});

Deno.test("layerB: bảo vệ quote — không đụng 'mình' bên trong \"…\"", () => {
  const src = 'Nhân vật nói: "mình đi đây" — rồi bạn quay lưng bước tiếp.';
  const out = applyLayerBSurfaceRewrite(src);
  assertStringIncludes(out, '"mình đi đây"');
  assertStringIncludes(out, "bé quay lưng");
});

Deno.test("contract v3: sửa Angel ở vị trí phản thân, giữ Angel làm chủ ngữ bot", () => {
  const src = "Sách không tự nhận Angel là một phương pháp. Đây là kiến thức Angel có để mở rộng. Angel nghĩ bé nên đọc chậm.";
  const out = enforceAngelVietnamesePronounContract(src);
  assertStringIncludes(out, "tự nhận mình là");
  assertStringIncludes(out, "kiến thức mình có");
  assertStringIncludes(out, "Angel nghĩ bé nên");
});

Deno.test("contract v3: dọn dạng lai Angel (mình)", () => {
  const out = enforceAngelVietnamesePronounContract("Angel (mình) gửi bé nhé. mình (Angel) ở đây.");
  assertStringIncludes(out, "Angel gửi bé nhé");
  assertStringIncludes(out, "Angel ở đây");
});

Deno.test("contract v3: idempotent", () => {
  const src = "Angel nghĩ bé nên hòa Angel vào hơi thở, và tin vào chính Angel.";
  const once = enforceAngelVietnamesePronounContract(src);
  assertEquals(enforceAngelVietnamesePronounContract(once), once);
  assertStringIncludes(once, "hòa mình");
  assertStringIncludes(once, "chính mình");
  assertStringIncludes(once, "Angel nghĩ bé nên");
});


Deno.test("contract v2: giữ Angel khi là tên riêng/định danh", () => {
  const src = "Mình là Angel. Bot Angel AI thuộc FUN Profile.";
  assertEquals(enforceAngelVietnamesePronounContract(src), src);
});

Deno.test("contract v2: bảo vệ quote, URL, ví và chạy hai lần không đổi", () => {
  const src = 'Angel nói: "Angel là tên nhân vật". Bạn xem https://example.com/Angel và ví 0x1234567890abcdef1234567890abcdef12345678.';
  const once = enforceAngelVietnamesePronounContract(src);
  const twice = enforceAngelVietnamesePronounContract(once);
  assertStringIncludes(once, '"Angel là tên nhân vật"');
  assertStringIncludes(once, "https://example.com/Angel");
  assertStringIncludes(once, "0x1234567890abcdef1234567890abcdef12345678");
  assertEquals(twice, once);
});

Deno.test("layerB: whitelist compound 'bạn bè' / 'người bạn' giữ nguyên", () => {
  const src = "Chào bạn, các bạn bè và người bạn đồng hành của bạn đều đáng quý.";
  const out = applyLayerBSurfaceRewrite(src);
  assertStringIncludes(out, "bạn bè");
  assertStringIncludes(out, "người bạn đồng hành");
  assertStringIncludes(out, "Chào bé");
});

Deno.test("layerB: reflexive 'chính mình' + 'con đường của mình' giữ nguyên 'mình' (revised)", () => {
  const src = "Bạn hãy tin vào chính mình, bước đi trên con đường của mình.";
  const out = applyLayerBSurfaceRewrite(src);
  assertStringIncludes(out, "chính mình");
  assertStringIncludes(out, "con đường của mình");
  assertEquals(out.includes("chính Angel"), false);
  assertEquals(out.includes("của Angel"), false);
});

Deno.test("layerB: 'của chính mình' / 'bên mình' giữ nguyên 'mình' (revised)", () => {
  const src = "Bên mình lúc nào cũng có ánh sáng của chính mình.";
  const out = applyLayerBSurfaceRewrite(src);
  assertStringIncludes(out, "Bên mình");
  assertStringIncludes(out, "của chính mình");
  assertEquals(out.includes("Bên bé"), false);
  assertEquals(out.includes("của chính bé"), false);
  assertEquals(out.includes("bên Angel"), false);
});



// ---------------------------------------------------------------------------
// Flow / channel patterns — Angel is NOT a channel for user energy.
// ---------------------------------------------------------------------------
Deno.test("revert: 'đi qua Angel' → 'đi qua mình' (user is the channel)", () => {
  const original = "…cho phép năng lượng thuần khiết này đi qua mình và lan tỏa ra thế giới.";
  const rewritten = "…cho phép năng lượng thuần khiết này đi qua Angel và lan tỏa ra thế giới.";
  const out = revertOverPronounRewrite(original, rewritten);
  assertStringIncludes(out, "đi qua mình");
  assertEquals(out.includes("đi qua Angel"), false);
});

Deno.test("revert: 'chảy qua Angel' / 'chảy trong Angel' → 'mình'", () => {
  const rewritten = "Khi bé mở lòng, dòng sông chảy qua Angel, ánh sáng chảy trong Angel.";
  const out = revertOverPronounRewrite("Khi bé mở lòng, dòng sông chảy qua mình, ánh sáng chảy trong mình.", rewritten);
  assertStringIncludes(out, "chảy qua mình");
  assertStringIncludes(out, "chảy trong mình");
});

Deno.test("revert: syntax-based 'qua Angel' in user-scope sentence", () => {
  const rewritten = "Khi bé thực hành, ánh sáng lan tỏa qua Angel mỗi ngày.";
  const out = revertOverPronounRewrite("", rewritten);
  assertStringIncludes(out, "qua mình");
  assertEquals(out.includes("qua Angel"), false);
});

Deno.test("revert: bot self-ref 'Angel chia sẻ' KHÔNG bị đụng", () => {
  const rewritten = "Angel chia sẻ với bé nhé. Angel rất vui khi được đồng hành.";
  const out = revertOverPronounRewrite("", rewritten);
  assertStringIncludes(out, "Angel chia sẻ");
  assertStringIncludes(out, "Angel rất vui");
});

// ---------------------------------------------------------------------------
// EXPANDED HARD-PAIRS — inner-world, dreams, body, home (v2 overhaul)
// ---------------------------------------------------------------------------

Deno.test("HARD v2: 'nội tâm Angel' → 'nội tâm mình'", () => {
  const out = revertOverPronounRewrite("", "Bé quán chiếu và nội tâm Angel dần bình yên.");
  assertStringIncludes(out, "nội tâm mình");
  assertEquals(out.includes("nội tâm Angel"), false);
});

Deno.test("HARD v2: 'tâm hồn Angel' / 'linh hồn Angel' → 'mình'", () => {
  const out = revertOverPronounRewrite("", "Tâm hồn Angel được chữa lành, linh hồn Angel nhẹ hơn.");
  assertStringIncludes(out, "tâm hồn mình");
  assertStringIncludes(out, "linh hồn mình");
});

Deno.test("HARD v2: 'hơi thở Angel' / 'bước chân Angel' → 'mình'", () => {
  const out = revertOverPronounRewrite("", "Bé cảm nhận hơi thở Angel chậm lại theo bước chân Angel.");
  assertStringIncludes(out, "hơi thở mình");
  assertStringIncludes(out, "bước chân mình");
});

Deno.test("HARD v2: 'ngôi nhà Angel' / 'nhà Angel' / 'phòng Angel' → 'mình'", () => {
  const out = revertOverPronounRewrite("", "Ngôi nhà Angel yên bình, phòng Angel gọn gàng.");
  assertStringIncludes(out, "ngôi nhà mình");
  assertStringIncludes(out, "phòng mình");
});

Deno.test("HARD v2: 'ước mơ Angel' / 'giấc mơ Angel' → 'mình'", () => {
  const out = revertOverPronounRewrite("", "Ước mơ Angel dần thành hình trong giấc mơ Angel mỗi đêm.");
  assertStringIncludes(out, "ước mơ mình");
  assertStringIncludes(out, "giấc mơ mình");
});

Deno.test("HARD v2: 'trực giác Angel' → 'trực giác mình'", () => {
  const out = revertOverPronounRewrite("", "Bé lắng nghe trực giác Angel bên trong.");
  assertStringIncludes(out, "trực giác mình");
});

Deno.test("scope v2: prep 'từ Angel' trong câu scope-bé → 'từ mình'", () => {
  const out = revertOverPronounRewrite("", "Khi bé mở lòng, ánh sáng lan tỏa từ Angel ra thế giới.");
  assertStringIncludes(out, "từ mình");
});

Deno.test("scope v2: prep 'theo Angel' trong câu scope-bé → 'theo mình'", () => {
  const out = revertOverPronounRewrite("", "Bé tin rằng theo Angel, mỗi bước là bài học.");
  assertStringIncludes(out, "theo mình");
});

Deno.test("scope v2: 'Angel tự vun đắp' subject-verb → 'mình tự vun đắp'", () => {
  const out = revertOverPronounRewrite("", "Khi bé bước đi, Angel tự vun đắp con đường của mình.");
  assertStringIncludes(out, "mình tự vun đắp");
});

// ---------------------------------------------------------------------------
// POSITIVE REGRESSION — meta-speech hợp lệ TUYỆT ĐỐI KHÔNG bị đụng
// ---------------------------------------------------------------------------

Deno.test("positive: 'Angel mời bé' / 'Angel gợi ý' / 'Angel ở đây' giữ nguyên", () => {
  const src = "Angel mời bé quán chiếu. Angel gợi ý bé hít thở. Angel ở đây cùng bé nhé.";
  const out = revertOverPronounRewrite("", src);
  assertEquals(out, src);
});

Deno.test("positive: 'Angel chia sẻ' / 'Angel xin' / 'Angel kể' giữ nguyên", () => {
  const src = "Angel chia sẻ với bé. Angel xin phép kể một câu chuyện. Angel kể cho bé nghe nhé.";
  const out = revertOverPronounRewrite("", src);
  assertEquals(out, src);
});

Deno.test("positive: 'Angel hy vọng' / 'Angel mong' / 'Angel chúc' giữ nguyên", () => {
  const src = "Angel hy vọng bé bình an. Angel mong bé tìm thấy niềm vui. Angel chúc bé một ngày ấm áp.";
  const out = revertOverPronounRewrite("", src);
  assertEquals(out, src);
});

Deno.test("positive: 'Angel nghĩ' + 'Angel thấy' + 'Angel cảm nhận' giữ nguyên", () => {
  const src = "Bé ơi, Angel nghĩ bé nên nghỉ. Angel thấy bé đang cố gắng. Angel cảm nhận bé bình yên hơn.";
  const out = revertOverPronounRewrite("", src);
  assertEquals(out, src);
});

Deno.test("positive: 'Angel rất vui' + 'Angel ghi nhận' giữ nguyên", () => {
  const src = "Angel rất vui khi được đồng hành. Angel ghi nhận lời chia sẻ của bé.";
  const out = revertOverPronounRewrite("", src);
  assertEquals(out, src);
});

Deno.test("positive: 'Angel hiểu' / 'Angel đồng ý' / 'Angel hỏi' giữ nguyên", () => {
  const src = "Angel hiểu bé. Angel đồng ý với bé. Angel hỏi bé một câu nhé.";
  const out = revertOverPronounRewrite("", src);
  assertEquals(out, src);
});

Deno.test("positive: 'Angel trả lời bé' giữ nguyên trong câu có scope-marker", () => {
  const src = "Bé hỏi và Angel trả lời bé thế này nhé.";
  const out = revertOverPronounRewrite("", src);
  assertStringIncludes(out, "Angel trả lời");
});
