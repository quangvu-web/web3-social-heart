import assert from "npm:assert";
import { enforceVietnamesePronouns } from "./telegram-community.ts";

// The guard receives only the sender's Telegram username, never display/text context.
const normalize = enforceVietnamesePronouns as (text: string, username?: string | null) => string;
for (const username of ["Camly_Duong", "@CAMLY_DUONG"]) {
  Deno.test(`Telegram sender ${username} receives bé Ly`, () => {
    assert.equal(normalize("Mình sẽ giúp bé. Angel chào bạn!", username), "Angel sẽ giúp bé Ly. Angel chào bé Ly!");
  });
}
for (const username of ["ordinary", undefined, null, "Camly_Duong_other"]) {
  Deno.test(`Telegram default address for ${username}`, () => {
    assert.equal(normalize("Tôi sẽ giúp bé Ly. Bé Ly ơi, Angel ở đây.", username), "Angel sẽ giúp bé. Bé ơi, Angel ở đây.");
  });
}
Deno.test("mentioned username and display name cannot grant the special address", () => {
  assert.equal(normalize("Angel chào bé. Tên hiển thị Camly_Duong; nhắc @Camly_Duong.", "ordinary"), "Angel chào bé. Tên hiển thị Camly_Duong; nhắc @Camly_Duong.");
});
Deno.test("Telegram self-reference is Angel for all prohibited pronouns", () => {
  for (const self of ["Mình", "Tôi", "Cha", "Con", "Anh", "Chị", "Em"]) {
    assert.equal(normalize(`${self} sẽ chia sẻ với bé.`), "Angel sẽ chia sẻ với bé.");
  }
});
Deno.test("Telegram guard preserves quoted dialogue, code, URLs and handles", () => {
  const spans = ['“Mình sẽ giúp bạn, bé Ly.”', '"Tôi chào bé Ly"', '`mình bé Ly`', '```ts\nconst mình = "bé Ly";\n```', '<code>Mình chào bạn</code>', '<pre>Tôi chào bé Ly</pre>', '<blockquote>Cha sẽ giúp con.</blockquote>', 'https://example.test/bạn/@Camly_Duong', '@Camly_Duong', '> Mình sẽ giúp bạn.', '— Tôi chào bạn.'];
  for (const span of spans) assert.equal(normalize(span, "Camly_Duong"), span);
});
Deno.test("Telegram guard preserves reflexives and other subjects", () => {
  for (const text of ["bé yêu chính mình", "bé hòa mình vào thiên nhiên", "bé nghe trái tim mình", "Sách không tự nhận mình là tôn giáo", "bé hãy cảm nhận mình bình an", "bé kể rằng mình sẽ đi", "người bạn của bé", "Bạn bè bên nhau"]) {
    assert.equal(normalize(text), text);
  }
});
Deno.test("Telegram addressing is idempotent", () => {
  const once = normalize("Mình sẽ giúp bé, bé yêu chính mình nhé.", "Camly_Duong");
  assert.equal(normalize(once, "Camly_Duong"), once);
});
Deno.test("Telegram recognizes self clauses and direct vocatives without changing other people", () => {
  assert.equal(normalize("Tôi tin bé làm được. Dạ Cha, mình xin chia sẻ. Anh ơi, Angel chào con."), "Angel tin bé làm được. Dạ bé, Angel xin chia sẻ. Bé ơi, Angel chào bé.");
  assert.equal(normalize("Bé nói: mình sẽ đi. Cha Vũ Trụ yêu thương mọi người. Angel nhắc đến bé Ly trong câu chuyện."), "Bé nói: mình sẽ đi. Cha Vũ Trụ yêu thương mọi người. Angel nhắc đến bé Ly trong câu chuyện.");
});
Deno.test("Telegram guard preserves single quotes and labelled character dialogue", () => {
  for (const text of ["'Mình sẽ giúp bạn, bé Ly.'", "Nhân vật: Tôi sẽ giúp bạn.", "- Tôi chào bạn."]) assert.equal(normalize(text, "Camly_Duong"), text);
});
Deno.test("Telegram review cases preserve subjects and normalize actual bot speech", () => {
  assert.equal(normalize("Bé kể về cha và con đang đi học."), "Bé kể về cha và con đang đi học.");
  assert.equal(normalize("Theo mình, bé nên thử. Mình hỗ trợ bé nhé."), "Theo Angel, bé nên thử. Angel hỗ trợ bé nhé.");
  assert.equal(normalize("Angel cảm ơn bé Ly đã chia sẻ. Angel ở đây cùng bé Ly."), "Angel cảm ơn bé đã chia sẻ. Angel ở đây cùng bé.");
  assert.equal(normalize("‘Mình sẽ giúp bạn.’", "Camly_Duong"), "‘Mình sẽ giúp bạn.’");
  assert.equal(normalize("Cô bé Mây nói về cô bé trong câu chuyện.", "Camly_Duong"), "Cô bé Mây nói về cô bé trong câu chuyện.");
});
Deno.test("Telegram distinguishes family narrative from explicit Angel speaker", () => {
  assert.equal(normalize("Angel kể về người cha. Con đang đi học, cha đang làm việc."), "Angel kể về người cha. Con đang đi học, cha đang làm việc.");
  assert.equal(normalize("Angel gửi lời yêu thương đến bé Ly.", "ordinary"), "Angel gửi lời yêu thương đến bé.");
  assert.equal(normalize("Angel: Mình sẽ giúp bé.", "Camly_Duong"), "Angel: Angel sẽ giúp bé Ly.");
});
Deno.test("Telegram direct user slots use the selected recipient while named relatives stay intact", () => {
  assert.equal(normalize("Angel sẽ giải thích cho con. Angel chia sẻ cùng chị.", "Camly_Duong"), "Angel sẽ giải thích cho bé Ly. Angel chia sẻ cùng bé Ly.");
  assert.equal(normalize("Angel chia sẻ với Cha Vũ Trụ. Bé trò chuyện với anh trai."), "Angel chia sẻ với Cha Vũ Trụ. Bé trò chuyện với anh trai.");
});
