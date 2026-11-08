import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as policy from "../../../supabase/functions/_shared/reply-candidates-policy";

const requirePackage = createRequire(import.meta.url);
const { act, create } = requirePackage("react-test-renderer");

function harness() {
  let flag: { enabled: boolean; updated_at: string } | null = null;
  let readError = false;
  let conflict = false;
  let scanError = false;
  let onCreated = 0;
  const writes: unknown[] = [];
  const scans: Array<Record<string, unknown>> = [];
  const db = { from(table: string) {
    let update: any = null;
    const filters: Record<string, unknown> = {};
    const q: any = {
      select() { return q; }, eq(k: string, v: unknown) { filters[k] = v; return q; },
      is(k: string, v: unknown) { filters[k] = v; return q; }, in(k: string, v: unknown) { filters[k] = v; return q; },
      gte() { return q; }, order() { return q; }, limit(n: number) { filters.limit = n; return q; },
      abortSignal() { return q; },
      update(p: unknown) { update = p; return q; },
      async insert(p: any) { writes.push(p); flag = { enabled: p.enabled, updated_at: "first" }; return { error: null }; },
      async maybeSingle() { return { data: readError ? null : flag, error: readError ? { message: "offline" } : null }; },
      then(resolve: (v: unknown) => void) {
        if (table === "telegram_ai_conversations") {
          scans.push(filters); resolve({ data: scanError ? null : [], error: scanError ? { message: "offline" } : null }); return;
        }
        if (update && !conflict) { writes.push(update); flag = { ...update, updated_at: "next" }; }
        resolve({ count: conflict ? 0 : 1, error: null });
      },
    }; return q;
  }};
  const boundaryRequire = (name: string) => {
    if (name === "react" || name === "react/jsx-runtime") return requirePackage(name);
    if (name.includes("supabase/client")) return { supabase: db };
    if (name.includes("reply-candidates-policy")) return policy;
    if (name.includes("reply-candidates")) return { saveReplyCandidate: () => { throw Error("No candidates in fixture"); } };
    return new Proxy({}, { get: (_target, key) => key === "Button" ? "button" : key === "Input" ? "input" : key === "CardTitle" ? "h3" : "div" });
  };
  const code = ts.transpileModule(readFileSync(new URL("./ReplyCandidatesPanel.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} as any };
  new Function("require", "module", "exports", code)(boundaryRequire, module, module.exports);
  let tree: any;
  act(() => { tree = create(requirePackage("react").createElement(module.exports.default, { onCreated: () => { onCreated++; } })); });
  const text = () => JSON.stringify(tree.toJSON());
  const button = (label: string) => tree.root.findAllByType("button").find((n: any) => n.children.join("") === label);
  const click = async (label: string) => { const b = button(label); expect(b).toBeDefined(); expect(b.props.disabled).toBeFalsy(); await act(async () => { await b.props.onClick(); }); };
  const group = async (value: string) => { await act(async () => { tree.root.findByType("input").props.onChange({ target: { value } }); }); };
  return { text, button, click, group, writes, scans, created: () => onCreated,
    failRead: () => readError = true, conflict: () => conflict = true,
    existing: () => flag = { enabled: true, updated_at: "old" }, failScan: () => scanError = true,
    close: () => act(() => tree.unmount()),
  };
}

describe("Reply candidate admin controls", () => {
  test("missing flag is OFF; explicit group enable is read back and changing groups clears stale state", async () => {
    const h = harness();
    try {
      await h.group("-1001"); await h.click("Chọn nhóm / tải lại cấu hình");
      expect(h.text()).toContain("đang tắt"); expect(h.writes).toHaveLength(0);
      await h.click("Bật tự gom cho nhóm này");
      expect(h.writes).toEqual([{ key: "library.capture.group.-1001", enabled: true, description: expect.any(String), meta: {} }]);
      expect(h.text()).toContain("đang bật");
      await h.group("-1002"); expect(h.button("Tắt tự gom cho nhóm này")).toBeUndefined();
    } finally { h.close(); }
  });
  test("read errors never become a false OFF state or allow writes", async () => {
    const h = harness();
    try {
      h.failRead(); await h.group("-1001"); await h.click("Chọn nhóm / tải lại cấu hình");
      expect(h.text()).toContain("Không đọc được cấu hình");
      expect(h.button("Bật tự gom cho nhóm này")).toBeUndefined(); expect(h.writes).toHaveLength(0);
    } finally { h.close(); }
  });
  test("CAS conflicts require reload and cannot optimistically report success", async () => {
    const h = harness();
    try {
      h.existing(); await h.group("-1001"); await h.click("Chọn nhóm / tải lại cấu hình"); h.conflict();
      await h.click("Tắt tự gom cho nhóm này");
      expect(h.text()).toContain("Cấu hình đã thay đổi"); expect(h.writes).toHaveLength(0);
      expect(h.button("Tắt tự gom cho nhóm này")).toBeUndefined();
    } finally { h.close(); }
  });
  test("history reads are limited to the selected group; unavailable data is not an empty success", async () => {
    const h = harness();
    try {
      await h.group("-1001"); await h.click("Chọn nhóm / tải lại cấu hình");
      await h.click("Quét lịch sử và tạo bản nháp (tối đa 100 lượt)");
      expect(h.scans[0]).toMatchObject({ group_id: -1001, source: "telegram", provider: "funcore", error: null, reply_message_id: null, limit: 100 });
      expect(h.text()).toContain("Đã quét"); h.failScan();
      await h.click("Quét lịch sử và tạo bản nháp (tối đa 100 lượt)");
      expect(h.text()).toContain("Quét chưa hoàn tất"); expect(h.created()).toBe(0);
    } finally { h.close(); }
  });
});
