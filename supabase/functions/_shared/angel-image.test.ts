import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { detectImageIntent, extractAngelImagePayload } from "./angel-image.ts";

const B64 = "a".repeat(520);

Deno.test("image intent: three reported Telegram prompts detect generate", () => {
  for (const prompt of [
    "Vẽ giúp con hình con mèo",
    "Tạo hình ảnh về tàu vũ trụ giúp con",
    "Angel vẽ giúp bé cảnh hoàng hôn trên biển",
  ]) {
    const intent = detectImageIntent(prompt, false);
    assertEquals(intent?.mode, "generate", prompt);
  }
});

Deno.test("extract image: OpenAI data[0].b64_json", () => {
  const out = extractAngelImagePayload({ data: [{ b64_json: B64 }] });
  assertEquals(out.kind, "base64");
  assertEquals(out.path, "data[0].b64_json");
  assertStringIncludes(out.image_base64 ?? "", "aaaa");
});

Deno.test("extract image: markdown URL inside text response", () => {
  const out = extractAngelImagePayload({ result: { text: "Ảnh đây: ![](https://cdn.example.com/generated/cat.png)" } });
  assertEquals(out.kind, "url");
  assertEquals(out.image_url, "https://cdn.example.com/generated/cat.png");
});

Deno.test("extract image: raw SSE text with completed frame", () => {
  const out = extractAngelImagePayload(`event: image_generation.completed\ndata: {"type":"image_generation.completed","b64_json":"${B64}"}\n\n`);
  assertEquals(out.kind, "base64");
  assertStringIncludes(out.path ?? "", "text_b64");
});

Deno.test("extract image: data URL nested in non-standard output", () => {
  const out = extractAngelImagePayload({ output: { assets: [{ final: `data:image/png;base64,${B64}` }] } });
  assertEquals(out.kind, "base64");
  assertEquals(out.mime_type, "image/png");
});