import assert from "node:assert/strict";
import ts from "npm:typescript@5.8.3";

const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const functions = source.slice(source.indexOf("function buildRecallBotBody"), source.indexOf("// ---------- Dịch & tóm tắt"));
const code = ts.transpileModule(`
const KEYTERMS = ["Urantia"];
let responses = [];
export function configure(values) { responses = values; }
export const sent = [];
async function recallFetch(path, init) { sent.push(JSON.parse(init.body)); return responses.shift(); }
${functions}
export { createRecallBot };
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const mod = await import(`data:application/javascript,${encodeURIComponent(code)}`);

const keytermsStart = source.indexOf("const KEYTERMS = [");
assert.ok(keytermsStart >= 0);
const productionCode = ts.transpileModule(`
${source.slice(keytermsStart, source.indexOf("\n];", keytermsStart) + 3)}
${functions}
export { buildRecallBotBody };
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const production = await import(`data:application/javascript,${encodeURIComponent(productionCode)}`);

Deno.test("production STT payload includes meditation terms without changing existing keyterms", () => {
  const keyterms = production.buildRecallBotBody("https://zoom.us/j/1", "session", "https://functions.example/caption")
    .recording_config.transcript.provider.assembly_ai_v3_streaming.keyterms_prompt;
  const added = ["gia hộ", "tinh tấn", "hồi hướng", "thiền nhân", "buổi thiền", "thời thiền", "chư vị đại giác ngộ", "hộ pháp", "mẹ em bé Angel Cam Ly", "em bé Angel Cam Ly"];
  for (const term of added) {
    assert.equal(keyterms.filter((value: string) => value === term).length, 1, `missing/duplicate ${term}`);
  }
  assert.deepEqual(keyterms.filter((term: string) => !added.includes(term)), [
    "Urantia", "Melchizedek", "Machiventa", "Nebadon", "Orvonton", "Havona",
    "Satania", "Norlatiadek", "Thought Adjuster", "Điều Chỉnh Tư Duy",
    "Đấng Cha Vũ Trụ", "Sảnh Phục Sinh", "Resurrection Hall",
    "thiên thần hộ mệnh", "sứ giả trung gian", "thế giới nhà ở",
    "hành trình thăng thiên", "Kinh Urantia", "FUN Community", "Fun.Rich",
    "LoveHub", "FUN-ID", "CAMLY", "Angel Translator", "Daniels Hussaini",
    "Angel Kim", "Hoàng Tỷ Đô", "bé Ly", "Richard E. Warren",
    "The Melchizedek Mission", "The First Humans", "Abuja", "Nigeria",
    "meditation", "mindfulness", "đội ơn",
  ]);
});

Deno.test("create bot accepts tuned turn silence with existing language and keyterms", async () => {
  mod.sent.length = 0;
  mod.configure([{ ok: true, status: 201, data: { id: "bot-fast" } }]);
  const result = await mod.createRecallBot("https://zoom.us/j/1", "session-1", "https://functions.example/caption");
  assert.equal(result.botId, "bot-fast");
  assert.equal(mod.sent.length, 1);
  assert.deepEqual(mod.sent[0].recording_config.transcript.provider.assembly_ai_v3_streaming, {
    language_detection: true, keyterms_prompt: ["Urantia"], min_turn_silence: 200, max_turn_silence: 1200,
  });
  assert.equal("end_of_turn_confidence_threshold" in mod.sent[0].recording_config.transcript.provider.assembly_ai_v3_streaming, false);
});

Deno.test("create bot retries with proven baseline if Recall rejects either new silence setting", async () => {
  for (const rejected of ["min_turn_silence", "max_turn_silence"]) {
    mod.sent.length = 0;
    mod.configure([
      { ok: false, status: 400, data: { message: `Invalid ${rejected}` } },
      { ok: true, status: 201, data: { id: "bot-baseline" } },
    ]);
    const result = await mod.createRecallBot("https://zoom.us/j/1", "session-1", "https://functions.example/caption");
    assert.equal(result.botId, "bot-baseline");
    assert.equal(mod.sent.length, 2);
    for (const body of mod.sent) {
      assert.deepEqual(body.recording_config.realtime_endpoints[0].events,
        ["transcript.data", "transcript.partial_data", "participant_events.join"]);
    }
    assert.deepEqual(mod.sent[1].recording_config.transcript.provider.assembly_ai_v3_streaming, {
      language_detection: true, keyterms_prompt: ["Urantia"],
    });
  }
});

Deno.test("new bots subscribe to participant join without dropping final or partial transcripts", async () => {
  mod.sent.length = 0;
  mod.configure([{ ok: true, status: 201, data: { id: "bot-join" } }]);
  await mod.createRecallBot("https://zoom.us/j/1", "session-join", "https://functions.example/caption");
  assert.deepEqual(mod.sent[0].recording_config.realtime_endpoints, [{
    type: "webhook", url: "https://functions.example/caption?action=recall-webhook",
    events: ["transcript.data", "transcript.partial_data", "participant_events.join"],
  }]);
});
