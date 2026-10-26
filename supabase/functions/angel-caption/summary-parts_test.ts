import assert from "node:assert/strict";
import { splitSummaryMessages, telegramTextLength } from "./summary-parts.ts";

const stripLabels = (parts: string[]) => parts.map(p=>p.replace(/^\(phần \d+\/\d+\)\n/, "")).join("");

Deno.test("short messages through 3800 visible characters remain byte-for-byte unchanged", () => {
  for(const text of ["📝 <b>Tóm tắt</b>\n• Việt / English", "x".repeat(3800), "&amp;".repeat(3800)])
    assert.deepEqual(splitSummaryMessages(text), [text]);
});

Deno.test("oversized section splits only between complete formatted bilingual bullets", () => {
  const bullets = Array.from({length:16},(_,i)=>`• <b>Ý ${i}:</b> ${"Ánh sáng &amp; yêu thương / Light and love. ".repeat(12)}\n`);
  const text = "📝 Tóm tắt\n🎯 <b>1) Chủ đề</b>\n• Thiền / Meditation\n💡 <b>2) Điểm chính</b>\n" + bullets.join("") + "❓ <b>3) Q&amp;A</b>\n• Q?\n• A.\n✅ <b>4) Actions</b>\n• Practice.\n";
  const parts=splitSummaryMessages(text);
  assert.ok(parts.length>2);
  assert.equal(stripLabels(parts),text);
  for(const bullet of bullets) assert.equal(parts.filter(p=>p.includes(bullet)).length,1);
  for(const part of parts) {
    assert.ok(telegramTextLength(part)+245<=3800);
    assert.equal((part.match(/<b>/g)??[]).length,(part.match(/<\/b>/g)??[]).length);
    assert.doesNotMatch(part, /&(?:a|am|l|g)$/);
  }
});

Deno.test("bullet continuation lines and whole sentences stay attached", () => {
  const bullet="• Câu hỏi / Question?\n"+"Dòng tiếp nối / Continued answer. ".repeat(45)+"\n";
  const text="💡 <b>Điểm chính</b>\n"+bullet.repeat(4);
  const parts=splitSummaryMessages(text);
  assert.equal(stripLabels(parts),text);
  assert.equal(parts.reduce((n,p)=>n+p.split(bullet).length-1,0),4);
});

Deno.test("a single impossible bullet rejects before truncating a sentence or entity", () => {
  assert.throws(()=>splitSummaryMessages("💡 <b>Điểm chính</b>\n• "+"x".repeat(4000)), /bullet exceeds/);
});

Deno.test("preferred section grouping keeps Q&A and actions together even with spare room in part one",()=>{
  const text="📝 Header\n🎯 Topic\n• "+"a".repeat(500)+"\n💡 Points\n• "+"b".repeat(2100)+"\n❓ Q&A\n• "+"c".repeat(500)+"\n✅ Actions\n• "+"d".repeat(800);
  const parts=splitSummaryMessages(text);
  assert.equal(parts.length,2);
  assert.doesNotMatch(parts[0],/❓|✅/);
  assert.match(parts[1],/❓[\s\S]*✅/);
  assert.equal(stripLabels(parts),text);
});

Deno.test("a large but sendable whole bullet must not suppress all summary delivery",()=>{
  const text="🎯 Topic\n• "+"a".repeat(450)+"\n💡 Points\n• "+"b".repeat(3500);
  const parts=splitSummaryMessages(text);
  assert.equal(stripLabels(parts),text);
  assert.ok(parts.some(p=>p.includes("b".repeat(3500))));
  const warning="\n⚠️ Chưa đăng được tóm tắt vào nhóm cộng đồng (lý do: "+"x".repeat(160)+"). Bé vẫn nhận bản sao tại đây.";
  assert.ok(telegramTextLength(parts.at(-1)!+warning)<=3800);
});
