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
    assert.deepEqual(mod.sent[1].recording_config.transcript.provider.assembly_ai_v3_streaming, {
      language_detection: true, keyterms_prompt: ["Urantia"],
    });
  }
});
