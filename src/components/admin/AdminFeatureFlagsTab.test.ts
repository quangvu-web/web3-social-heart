import { describe, expect, test } from "bun:test";
import React from "react";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";

const requirePackage = createRequire(import.meta.url);
const { act, create } = requirePackage("react-test-renderer");
const services = [
  { key: "ai.provider.caption", label: "Dịch phụ đề" },
  { key: "ai.provider.vision", label: "Đọc ảnh" },
  { key: "ai.provider.ocr", label: "Quét chữ trong ảnh (OCR)" },
];
const stamp = "2026-10-28T01:00:00+08:00";
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function harness() {
  const rows = new Map([
    ...services.map(({ key }, i) => [key, { key, enabled: true, meta: { value: i === 1 ? "gemini" : "lovable" }, description: null, updated_at: `2026-10-28T0${i + 1}:00:00+08:00` }] as const),
    ["ai.provider", { key: "ai.provider", enabled: true, meta: { value: "gemini" }, description: null, updated_at: stamp }] as const,
    ["cost.vision_describe_enabled", { key: "cost.vision_describe_enabled", enabled: true, meta: null, description: null, updated_at: stamp }] as const,
  ]);
  const writes: Array<Record<string, any>> = [];
  const operations: string[] = [];
  const notices = { success: [] as string[], warning: [] as string[], error: [] as string[] };
  const gates = new Map<string, ReturnType<typeof deferred>>();
  let nextLoad: ReturnType<typeof deferred> | null = null;
  let readError: string | null = null;
  let mismatch: string | null = null;
  let loadError = false;
  const db = {
    from(table: string) {
      expect(table).toBe("angel_feature_flags");
      let key = "";
      const query = {
        select() { operations.push("select"); return query; },
        eq(column: string, value: string) { expect(column).toBe("key"); key = value; return query; },
        async order() {
          const snapshot = [...rows.values()];
          const gate = nextLoad; nextLoad = null;
          if (gate) await gate.promise;
          return { data: loadError ? null : snapshot, error: loadError ? { message: "load failed" } : null };
        },
        async maybeSingle() {
          if (readError === key) return { data: null, error: { message: "read failed" } };
          const row = rows.get(key) ?? null;
          if (mismatch === key && row) return { data: { ...row, meta: { value: "lovable" } }, error: null };
          return { data: row, error: null };
        },
        async upsert(value: Record<string, any>, options: { onConflict: string }) {
          expect(options.onConflict).toBe("key"); operations.push("upsert"); writes.push(value);
          await gates.get(value.key)?.promise;
          rows.set(value.key, { ...value, updated_at: stamp } as any);
          return { error: null };
        },
      };
      return query;
    },
  };
  const boundaryRequire = (name: string) => {
    if (name === "react" || name === "react/jsx-runtime") return requirePackage(name);
    if (name.includes("supabase/client")) return { supabase: db };
    if (name === "sonner") return { toast: Object.fromEntries(Object.entries(notices).map(([kind, values]) => [kind, (message: string) => values.push(message)])) };
    if (name === "lucide-react") return { Loader2: () => null, Flag: () => null, RefreshCw: () => null, Plus: () => null };
    return new Proxy({}, { get: (_target, key) => key === "Switch" ? "switch" : key === "Button" ? "button" : key === "Input" ? "input" : key === "CardTitle" ? "h3" : "div" });
  };
  const source = ts.transpileModule(readFileSync(new URL("./AdminFeatureFlagsTab.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: { default?: React.ComponentType } = {};
  new Function("require", "exports", source)(boundaryRequire, exports);
  let view: any;
  const mount = async () => { await act(async () => { view = create(React.createElement(exports.default!)); }); };
  const unmount = async () => { await act(async () => view.unmount()); };
  const group = (i: number) => view.root.findByProps({ role: "group", "aria-label": services[i].label });
  const toggle = (i: number) => group(i).findByType("switch");
  const change = async (i: number, value: boolean) => { await act(async () => { await toggle(i).props.onCheckedChange(value); }); };
  const startChange = async (i: number, value: boolean) => { await act(async () => { void toggle(i).props.onCheckedChange(value); }); };
  const reload = async () => { await act(async () => { view.root.findAllByType("button").find((node: any) => node.children.some((child: any) => typeof child === "string" && child.includes("Reload"))).props.onClick(); }); };
  return { rows, writes, operations, notices, gates, mount, unmount, group, toggle, change, startChange, reload,
    gateLoad() { const gate = deferred(); nextLoad = gate; return gate; },
    setReadError(key: string | null) { readError = key; },
    setMismatch(key: string | null) { mismatch = key; },
    setLoadError(value: boolean) { loadError = value; },
    get view() { return view; },
  };
}

describe("per-service AI provider controls", () => {
  test("three rows read their own value and Malaysia timestamp; all four reserved keys stay hidden", async () => {
    const h = harness(); await h.mount();
    try {
      expect(services.map((_, i) => h.toggle(i).props.checked)).toEqual([false, true, false]);
      for (let i = 0; i < 3; i++) {
        const status = h.group(i).findByProps({ role: "status" });
        const flatten = (node: any): string => typeof node === "string" ? node : (node.children ?? []).map(flatten).join("");
        const text = flatten(status);
        expect(text).toContain(new Date(h.rows.get(services[i].key)!.updated_at).toLocaleString("vi-VN", { timeZone: "Asia/Kuala_Lumpur" }));
      }
      expect(h.view.root.findAllByType("code").map((node: any) => node.children.join(""))).toEqual(["cost.vision_describe_enabled"]);
      expect(JSON.stringify(h.view.toJSON())).toContain("Mỗi dịch vụ có công tắc riêng; đổi một dịch vụ không ảnh hưởng dịch vụ khác.");
    } finally { await h.unmount(); }
  });
  test("only the chosen key is upserted, separately reread and restored correctly after remount", async () => {
    const h = harness(); await h.mount();
    try {
      await h.change(0, true);
      expect(h.writes.map((row) => row.key)).toEqual([services[0].key]);
      expect(h.operations.slice(-2)).toEqual(["upsert", "select"]);
      expect(h.rows.get("ai.provider")!.meta).toEqual({ value: "gemini" });
      expect(h.toggle(2).props.checked).toBe(false);
      await h.unmount(); await h.mount(); expect(h.toggle(0).props.checked).toBe(true);
      await h.change(1, false); await h.change(2, true);
      await h.unmount(); await h.mount();
      expect(services.map((_, i) => h.toggle(i).props.checked)).toEqual([true, false, true]);
      expect(h.notices.success.length).toBe(3);
    } finally { await h.unmount(); }
  });
  test("saving one row leaves other services usable and blocks duplicate saves only for that key", async () => {
    const h = harness(); await h.mount(); const gate = deferred(); h.gates.set(services[1].key, gate);
    try {
      await h.startChange(1, false);
      expect(h.toggle(1).props.disabled).toBe(true); expect(h.toggle(0).props.disabled).toBe(false); expect(h.toggle(2).props.disabled).toBe(false);
      await h.startChange(1, true); await h.change(0, true); await h.change(2, true);
      expect(h.writes.filter((row) => row.key === services[1].key).length).toBe(1);
      await act(async () => gate.resolve());
      expect(services.map((_, i) => h.toggle(i).props.checked)).toEqual([true, false, true]);
    } finally { gate.resolve(); await h.unmount(); }
  });
  test("a stale reload finishing after a save cannot overwrite that service", async () => {
    const h = harness(); await h.mount(); const save = deferred(); h.gates.set(services[0].key, save);
    try {
      await h.startChange(0, true); const load = h.gateLoad(); await h.reload();
      await act(async () => save.resolve()); expect(h.toggle(0).props.checked).toBe(true);
      await act(async () => load.resolve()); expect(h.toggle(0).props.checked).toBe(true);
    } finally { save.resolve(); await h.unmount(); }
  });
  test("readback mismatch has no success toast and displays the returned DB value", async () => {
    const h = harness(); await h.mount(); h.setMismatch(services[0].key);
    try {
      await h.change(0, true);
      expect(h.notices.success).toEqual([]); expect(h.notices.warning.length).toBe(1); expect(h.toggle(0).props.checked).toBe(false);
    } finally { await h.unmount(); }
  });
  test("readback failure disables only that row and reload can recover it", async () => {
    const h = harness(); await h.mount(); h.setReadError(services[0].key);
    try {
      await h.change(0, true); expect(h.notices.success).toEqual([]); expect(h.toggle(0).props.disabled).toBe(true);
      expect(h.toggle(1).props.disabled).toBe(false); expect(h.toggle(2).props.disabled).toBe(false);
      h.setReadError(null); await h.reload(); expect(h.toggle(0).props.disabled).toBe(false); expect(h.toggle(0).props.checked).toBe(true);
    } finally { await h.unmount(); }
  });
});
