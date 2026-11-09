import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as policy from "../../../supabase/functions/angel-caption/mc-script-policy";
import * as sources from "./mcScriptSource";

const requirePackage = createRequire(import.meta.url);
const React = requirePackage("react");
const { act, create } = requirePackage("react-test-renderer");
const raw = "Mọi việc Cha đã hoàn thành. Bạn chỉ cần hiện diện và đón nhận phước lành từ Cha Vũ Trụ.";
const vi = "Cha đã hoàn thành mọi việc. Bé chỉ cần hiện diện và đón nhận những phước lành từ Cha Vũ Trụ.";

function harness() {
  let loggedIn = true;
  let failed = false;
  let unavailable = false;
  let pending: ((value: unknown) => void) | null = null;
  let hold = false;
  const calls: Array<{ name: string; body: { stage: string; text: string }; signal: AbortSignal }> = [];
  const client = {
    auth: { getSession: async () => ({ data: { session: loggedIn ? {} : null }, error: null }) },
    functions: { invoke: async (name: string, options: any) => {
      calls.push({ name, ...options });
      if (hold) return await new Promise(resolve => { pending = resolve; });
      if (unavailable) return { data: null, error: { context: new Response(JSON.stringify({ error: "Unknown action" }), { status: 404 }) } };
      if (failed) return { data: null, error: { context: new Response(JSON.stringify({ error: "Bé thử lại sau nhé." }), { status: 429 }) } };
      return { data: { stage: options.body.stage, text: options.body.stage === "edit-vi" ? vi : "Everything is ready. Be here and receive the blessings of Father Universe." }, error: null };
    } },
  };
  const boundaryRequire = (name: string) => {
    if (name === "react" || name === "react/jsx-runtime") return requirePackage(name);
    if (name.includes("supabase/client")) return { supabase: client };
    if (name.includes("mc-script-policy")) return policy;
    if (name.includes("mcScriptSource")) return sources;
    throw Error("Unexpected import " + name);
  };
  const code = ts.transpileModule(readFileSync(new URL("./McScriptPanel.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} as any };
  new Function("require", "module", "exports", code)(boundaryRequire, module, module.exports);
  const props = { lines: [{ speaker_name: "MC", source_lang: "vi", text_source: raw }], fontSize: 28 };
  let tree: any;
  act(() => { tree = create(React.createElement(module.exports.default, props)); });
  const button = (label: string) => tree.root.findAllByType("button").find((n: any) => n.children.join("") === label);
  const click = async (label: string) => {
    const b = button(label); expect(b).toBeDefined(); expect(b.props.disabled).toBeFalsy();
    await act(async () => { await b.props.onClick(); });
  };
  const field = (label: string) => tree.root.findAllByType("textarea").find((n: any) => n.props["aria-label"] === label);
  const edit = async (label: string, value: string) => { await act(async () => { field(label).props.onChange({ target: { value } }); }); };
  return { calls, button, click, field, edit,
    text: () => JSON.stringify(tree.toJSON()),
    review: async () => { await act(async () => { tree.root.findByType("input").props.onChange({ target: { checked: true } }); }); },
    unavailable: () => unavailable = true,
    logout: () => loggedIn = false, fail: () => failed = true, hold: () => hold = true,
    release: async () => { await act(async () => { pending?.({ data: { stage: "edit-vi", text: vi }, error: null }); }); },
    updateLines: () => act(() => tree.update(React.createElement(module.exports.default, { ...props, lines: [...props.lines, { speaker_name: "Other", source_lang: "vi", text_source: "Dòng mới không được ghi đè bản MC đang sửa." }] }))),
    close: () => act(() => tree.unmount()),
  };
}

describe("MC read-back workspace", () => {
  test("MC loads a bounded single-speaker original passage and never combines translated lines or other speakers", () => {
    const line = (speaker_name: string, source_lang: string, text_source: string) => ({ speaker_name, source_lang, text_source });
    expect(sources.recentMcSource([line("Other", "vi", "Không lấy."), line("MC", "vi", "Một."), line("MC", "vi", "Hai.")])).toEqual({ speaker: "MC", count: 2, text: "Một.\nHai." });
    expect(() => sources.recentMcSource([line("MC", "en", "English source")])).toThrow();
    expect(() => sources.recentMcSource([line("MC", "vi", "x".repeat(6001))])).toThrow();
    expect(sources.recentMcSource(Array.from({ length: 8 }, (_, i) => line("MC", "vi", String(i)))).count).toBe(6);
    expect(sources.recentMcSource([{ speaker_name: null, source_lang: "vi", text_source: "Không gộp người không rõ." },
      { speaker_name: null, source_lang: "vi", text_source: "Chỉ lấy dòng cuối." }]).count).toBe(1);
  });
  test("English comes from the reviewed Vietnamese draft, not raw ASR; edits invalidate old English", async () => {
    const h = harness();
    try {
      await h.click("Lấy đoạn tiếng Việt gần nhất"); await h.click("Tạo bản Việt biên tập");
      expect(h.button("Dịch bản Việt đã rà soát sang Anh").props.disabled).toBe(true);
      const edited = vi + " Mọi thứ đã sẵn sàng.";
      await h.edit("Bản Việt biên tập", edited); await h.review(); await h.click("Dịch bản Việt đã rà soát sang Anh");
      expect(h.calls[1].body).toEqual({ stage: "translate-en", text: edited });
      expect(h.calls[0].name).toBe("angel-caption?action=mc-script");
      expect(h.field("Bản Anh để đọc thành lời").props.value).toContain("Everything");
      await h.edit("Bản Việt biên tập", vi);
      expect(h.field("Bản Anh để đọc thành lời").props.value).toBe("");
      expect(h.button("Dịch bản Việt đã rà soát sang Anh").props.disabled).toBe(true);
    } finally { h.close(); }
  });
  test("live updates do not overwrite drafts; changed source and unclear fragments require review", async () => {
    const h = harness();
    try {
      await h.click("Lấy đoạn tiếng Việt gần nhất"); await h.click("Tạo bản Việt biên tập"); h.updateLines();
      expect(h.field("Lời nói tiếng Việt gốc").props.value).toBe(raw);
      await h.edit("Lời nói tiếng Việt gốc", raw + " Một ý khác.");
      expect(h.field("Bản Việt biên tập").props.value).toBe(vi);
      expect(h.button("Dịch bản Việt đã rà soát sang Anh").props.disabled).toBe(true);
      await h.edit("Bản Việt biên tập", vi + " [chưa rõ: tên]");
      expect(h.button("Dịch bản Việt đã rà soát sang Anh").props.disabled).toBe(true);
    } finally { h.close(); }
  });
  test("signed-out viewers cannot invoke generation; provider failures preserve the draft", async () => {
    const h = harness();
    try {
      await h.click("Lấy đoạn tiếng Việt gần nhất"); h.logout(); await h.click("Tạo bản Việt biên tập");
      expect(h.calls).toHaveLength(0); expect(h.text()).toContain("Đăng nhập FUN Profile trong tab mới");
    } finally { h.close(); }
    const f = harness();
    try {
      await f.click("Lấy đoạn tiếng Việt gần nhất"); await f.click("Tạo bản Việt biên tập"); f.fail();
      await f.click("Biên tập lại bản Việt"); expect(f.field("Bản Việt biên tập").props.value).toBe(vi);
      expect(f.text()).toContain("Bé thử lại sau nhé.");
    } finally { f.close(); }
  });
  test("unmount aborts the pending generation request", async () => {
    const h = harness(); await h.click("Lấy đoạn tiếng Việt gần nhất"); h.hold();
    let done: Promise<void>;
    await act(async () => { done = h.button("Tạo bản Việt biên tập").props.onClick(); await Promise.resolve(); });
    expect(h.calls).toHaveLength(1); h.close(); expect(h.calls[0].signal.aborted).toBe(true); await h.release();
  });
  test("oversized pasted speech remains intact instead of silently truncating", async () => {
    const h = harness();
    try {
      const long = raw.repeat(100);
      await h.edit("Lời nói tiếng Việt gốc", long);
      expect(h.field("Lời nói tiếng Việt gốc").props.value).toBe(long);
      expect(h.button("Tạo bản Việt biên tập").props.disabled).toBe(true);
      expect(h.calls).toHaveLength(0);
    } finally { h.close(); }
  });
});

test("undeployed MC action shows an actionable error before the empty Vietnamese editor", async () => {
  const h = harness();
  try {
    await h.click("Lấy đoạn tiếng Việt gần nhất"); h.unavailable(); await h.click("Tạo bản Việt biên tập");
    const rendered = h.text();
    expect(rendered).toContain("Chức năng biên tập MC chưa sẵn sàng");
    expect(rendered.indexOf('"role":"alert"')).toBeLessThan(rendered.indexOf('"aria-label":"Bản Việt biên tập"'));
    expect(h.field("Lời nói tiếng Việt gốc").props.value).toBe(raw);
    expect(h.field("Bản Việt biên tập").props.value).toBe("");
    expect(h.button("Tạo bản Việt biên tập").props.disabled).toBeFalsy();
  } finally { h.close(); }
});
