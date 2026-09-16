import { assert, assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { classifyArtTopic, enrichImagePrompt } from "./angel/image-enrich.ts";

Deno.test("classifyArtTopic: architecture keywords", () => {
  for (const p of [
    "Vẽ hình ảnh ngôi nhà biệt thự đẹp",
    "Tạo hình một căn villa hiện đại view biển",
    "vẽ nội thất phòng khách sang trọng",
    "modern penthouse apartment interior",
    "kiến trúc chùa Việt Nam cổ",
  ]) {
    assertEquals(classifyArtTopic(p), "architecture", p);
  }
});

Deno.test("enrichImagePrompt: architecture appends no-people negative", () => {
  const { prompt, topic } = enrichImagePrompt("Vẽ biệt thự nghỉ dưỡng view biển");
  assertEquals(topic, "architecture");
  assert(/Do NOT include people/i.test(prompt), prompt);
  assert(/architectural photography/i.test(prompt), prompt);
});

Deno.test("enrichImagePrompt: portrait keeps people (no negative)", () => {
  const { prompt, topic } = enrichImagePrompt("Vẽ chân dung một cô gái Việt");
  assertEquals(topic, "portrait");
  assert(!/Do NOT include people/i.test(prompt), prompt);
});

Deno.test("enrichImagePrompt: landscape without explicit people gets negative", () => {
  const { prompt, topic } = enrichImagePrompt("phong cảnh núi non hùng vĩ");
  assertEquals(topic, "landscape");
  assert(/Do NOT include people/i.test(prompt), prompt);
});

Deno.test("enrichImagePrompt: landscape WITH people mention keeps them", () => {
  const { prompt } = enrichImagePrompt("phong cảnh núi non có một người leo núi");
  assert(!/Do NOT include people/i.test(prompt), prompt);
});
