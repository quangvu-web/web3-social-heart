import { describe, expect, test } from "bun:test";
import ts from "typescript";
import { readFileSync } from "node:fs";

function harness() {
  const effects: Array<() => (() => void)> = [];
  const intervals: Array<{ callback: () => void; delay: number }> = [];
  const timeouts: Array<{ callback: () => Promise<void>; delay: number }> = [];
  const events = new Map<string, () => void>();
  const states: unknown[] = [];
  let stateIndex = 0;
  let cursor = 0;
  let polls = 0;
  let subscriptions = 0;
  let removals = 0;
  let statusCallback = (_status: string) => {};
  const changeCallbacks = new Map<string, (payload: unknown) => void>();
  const session = { id: "session", public_code: "test", status: "live" };
  const line = { id: "one", seq: 1, text_source: "first" };
  const fresh = { id: "two", seq: 2, text_source: "second" };
  const supabase = {
    from(table: string) {
      let incremental = false;
      const query = {
        select() { return query; }, eq() { return query; },
        order() { return query; }, limit() { return query; },
        gt(_column: string, value: number) { incremental = true; cursor = value; return query; },
        maybeSingle() { return query; },
        then(resolve: (result: unknown) => void) {
          if (incremental) polls++;
          resolve({ error: null, data: table === "caption_sessions" ? session : table === "caption_partials" ? null : incremental ? [fresh, fresh] : [line] });
        },
      };
      return query;
    },
    channel() {
      const channel = {
        on(_kind: string, filter: { table: string; event: string }, callback: (payload: unknown) => void) {
          changeCallbacks.set(`${filter.table}:${filter.event}`, callback);
          return channel;
        },
        subscribe(callback: (status: string) => void) { statusCallback = callback; subscriptions++; return channel; },
      };
      return channel;
    },
    async removeChannel() { removals++; },
  };
  const react = {
    memo: (component: unknown) => component,
    useState(initial: unknown) {
      const i = stateIndex++;
      states[i] = initial;
      return [initial, (value: unknown) => { states[i] = typeof value === "function" ? value(states[i]) : value; }];
    },
    useRef(current: unknown) { return { current }; },
    useEffect(effect: () => (() => void)) { effects.push(effect); },
    useCallback(callback: unknown) { return callback; },
  };
  const document = { visibilityState: "hidden", addEventListener: (name: string, cb: () => void) => events.set(name, cb), removeEventListener: (name: string) => events.delete(name) };
  const window = { addEventListener: document.addEventListener, removeEventListener: document.removeEventListener };
  const code = ts.transpileModule(readFileSync(new URL("./CaptionsPage.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: { default?: () => unknown } = {};
  const require = (name: string) => {
    if (name === "react") return react;
    if (name === "react-router-dom") return { useParams: () => ({ code: "test" }) };
    if (name.includes("supabase/client")) return { supabase };
    return { jsx: () => null, jsxs: () => null };
  };
  new Function("require", "exports", "document", "window", "setInterval", "clearInterval", "setTimeout", "clearTimeout", code)(
    require, exports, document, window,
    (callback: () => void, delay: number) => { intervals.push({ callback, delay }); return intervals.length; },
    () => { intervals.length = 0; },
    (callback: () => Promise<void>, delay: number) => { timeouts.push({ callback, delay }); return timeouts.length; },
    () => { timeouts.length = 0; },
  );
  exports.default?.();
  const cleanup = effects[1]();
  const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  return { intervals, timeouts, events, states, document, cleanup, settle,
    status: (s: string) => statusCallback(s),
    emit: (table: string, event: string, payload: unknown) => changeCallbacks.get(`${table}:${event}`)?.(payload),
    get cursor() { return cursor; }, get polls() { return polls; }, get subscriptions() { return subscriptions; }, get removals() { return removals; } };
}

describe("caption recovery", () => {
  test("partial updates replace the ghost row and final deletion removes it", async () => {
    const h = harness();
    await h.settle();
    const first = { session_id: "session", speaker_name: "MC", text_source: "Hello", updated_at: new Date().toISOString() };
    h.emit("caption_partials", "INSERT", { eventType: "INSERT", new: first });
    expect(h.states[2]).toEqual(first);
    const next = { ...first, text_source: "Hello world" };
    h.emit("caption_partials", "UPDATE", { eventType: "UPDATE", new: next });
    expect(h.states[2]).toEqual(next);
    h.emit("caption_partials", "DELETE", { eventType: "DELETE", old: { session_id: "another" } });
    expect(h.states[2]).toEqual(next);
    h.emit("caption_partials", "DELETE", { eventType: "DELETE", old: { session_id: "session" } });
    expect(h.states[2]).toBeNull();
    h.cleanup();
  });
  test("polls every 4000 ms independently of Realtime and deduplicates by ID", async () => {
    const h = harness();
    await h.settle();
    expect(h.intervals[0].delay).toBe(4000);
    h.status("SUBSCRIBED");
    await h.settle();
    const before = h.polls;
    h.intervals[0].callback();
    await h.settle();
    expect(h.polls).toBe(before + 1);
    expect(h.cursor).toBe(2);
    expect((h.states[1] as Array<{ id: string }>).map(row => row.id)).toEqual(["one", "two"]);
    h.cleanup();
  });

  test("visible, focus and online trigger immediate catch-up without waiting for polling", async () => {
    const h = harness();
    await h.settle();
    const before = h.polls;
    h.events.get("visibilitychange")?.();
    await h.settle();
    expect(h.polls).toBe(before);
    h.document.visibilityState = "visible";
    for (const event of ["visibilitychange", "focus", "online"]) {
      const count = h.polls;
      h.events.get(event)?.();
      await h.settle();
      expect(h.polls).toBe(count + 1);
    }
    h.cleanup();
  });

  test("each socket failure reconnects after 2000 ms; unmount cancels recovery", async () => {
    for (const status of ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]) {
      const h = harness();
      await h.settle();
      h.status(status);
      expect(h.timeouts[0].delay).toBe(2000);
      const timer = h.timeouts.shift();
      await timer?.callback();
      expect(h.removals).toBe(1);
      expect(h.subscriptions).toBe(2);
      h.status(status);
      expect(h.timeouts.length).toBe(1);
      h.cleanup();
      expect(h.events.size).toBe(0);
      expect(h.intervals.length).toBe(0);
      expect(h.timeouts.length).toBe(0);
      h.status(status);
      expect(h.timeouts.length).toBe(0);
    }
  });
});
// Nạp các helper đã export từ CaptionsPage.tsx (transpile y như harness ở trên
// để không phải resolve alias @/ hay render DOM).
function loadCaptionHelpers() {
  const code = ts.transpileModule(readFileSync(new URL("./CaptionsPage.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: Record<string, unknown> = {};
  const require = (name: string) => {
    if (name === "react") return { memo: (component: unknown) => component, useState: () => [], useRef: () => ({}), useEffect: () => {}, useCallback: (c: unknown) => c };
    if (name === "react-router-dom") return { useParams: () => ({}) };
    if (name.includes("supabase/client")) return { supabase: {} };
    return { jsx: () => null, jsxs: () => null, Fragment: null, Minus: 0, Plus: 0, Loader2: 0, ArrowDown: 0 };
  };
  new Function("require", "exports", code)(require, exports);
  return exports as { captionSubFontSize: (size: number) => number };
}

describe("translated caption size", () => {
  const { captionSubFontSize } = loadCaptionHelpers();

  test("bilingual translation reads at 25px when the original is the default 28px", () => {
    expect(captionSubFontSize(28)).toBe(25);
  });

  test("each +/− step scales the translation at the same ratio as the original", () => {
    // Nút + tăng 4px mỗi nấc: hai nấc từ mặc định 28 → 36 → 44.
    expect(captionSubFontSize(28)).toBe(25);
    expect(captionSubFontSize(36)).toBe(32);
    expect(captionSubFontSize(44)).toBe(39);
  });

  test("translation stays readable and balanced across every size the buttons allow", () => {
    for (const size of [18, 22, 26, 30, 34, 38, 42, 46, 48]) {
      const sub = captionSubFontSize(size);
      expect(sub).toBeGreaterThanOrEqual(16);
      expect(sub).toBeLessThan(size);
      expect(sub).toBeGreaterThanOrEqual(Math.ceil(size * 0.85));
    }
    expect(captionSubFontSize(10)).toBe(16);
  });
});

// Render/effect harness preserves React hook state across partial/final updates.
function layoutHarness() {
  const states: any[] = [];
  const refs: any[] = [];
  const deps: any[][] = [];
  const pending: Array<() => void> = [];
  let stateIndex = 0, refIndex = 0, effectIndex = 0;
  const history = { scrollTop: 420, scrollHeight: 2000, clientHeight: 600 };
  const jsx = (type: any, props: any) => ({ type, props });
  const react = {
    memo: (component: unknown) => component,
    useState(initial: any) {
      const i = stateIndex++;
      if (!(i in states)) states[i] = initial;
      return [states[i], (v: any) => { states[i] = typeof v === "function" ? v(states[i]) : v; }];
    },
    useRef(value: any) { const i = refIndex++; return refs[i] ??= { current: value }; },
    useCallback: (cb: any) => cb,
    useEffect(cb: () => void, next: any[]) {
      const i = effectIndex++;
      if (i >= 2 && (!deps[i] || next.some((v, j) => v !== deps[i][j]))) pending.push(cb);
      deps[i] = next;
    },
  };
  const code = ts.transpileModule(readFileSync(new URL("./CaptionsPage.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: any = {};
  new Function("require", "exports", "requestAnimationFrame", code)((name: string) =>
    name === "react" ? react : name === "react-router-dom" ? { useParams: () => ({ code: "test" }) } :
    name.includes("supabase/client") ? { supabase: {} } : { jsx, jsxs: jsx }, exports, (cb: () => void) => cb());
  function render() {
    stateIndex = refIndex = effectIndex = 0;
    const tree = exports.default();
    refs[0].current = history;
    for (const cb of pending.splice(0)) cb();
    return tree;
  }
  render();
  states[0] = { status: "live" };
  const descendants = (node: any): any[] => !node || typeof node !== "object" ? [] :
    [node, ...[node.props?.children].flat(Infinity).flatMap(descendants)];
  const find = (tree: any, label: string) => descendants(tree).find(n => n.props?.["aria-label"] === label);
  return { states, refs, history, render, descendants, find };
}

describe("stable live speaking layout", () => {
  test("partial updates/translation wait/delete never scroll history or reset unread controls", () => {
    const h = layoutHarness();
    h.render();
    h.history.scrollTop = 420;
    h.states[7] = { visible: true, count: 3 };
    const unread = h.states[7];
    for (const text of ["Hello", "Hello world", "Hello world again", ""]) {
      h.states[2] = { text_source: text, updated_at: new Date().toISOString() };
      h.render();
      expect(h.history.scrollTop).toBe(420);
      expect(h.states[7]).toBe(unread);
    }
    h.states[2] = { text_source: "A fresh sentence before silence", updated_at: new Date().toISOString() };
    h.render();
    h.states[6] += 16000;
    const staleTree = h.render();
    expect(h.descendants(h.find(staleTree, "Người đang nói")).some((n: any) => n.props?.children === "A fresh sentence before silence…")).toBe(true);
    expect(h.history.scrollTop).toBe(420);
    expect(h.states[7]).toBe(unread);
    h.states[2] = null; h.render();
    expect(h.history.scrollTop).toBe(420);
    expect(h.states[7]).toBe(unread);
  });

  test("live panel is outside history and keeps its six-line box with stable children", () => {
    const h = layoutHarness();
    const panelShapes = [];
    for (const partial of [null, {text_source:"Hello",speaker_name:"MC",updated_at:new Date().toISOString()},
      {text_source:"word ".repeat(1000),updated_at:new Date().toISOString()},
      {text_source:"old sentence",updated_at:new Date(0).toISOString()}]) {
      h.states[2] = partial;
      const tree = h.render();
      const panel = h.find(tree, "Người đang nói");
      expect(panel).toBeDefined();
      expect(panel.props.className).toContain("h-[8.25em]");
      expect(panel.props.className).toContain("shrink-0");
      expect(panel.props.className).toContain("overflow-y-auto");
      expect(panel.props.className).toContain("overscroll-contain");
      expect(panel.props.style.fontSize).toBe(28);
      const history = h.find(tree, "Lịch sử phụ đề");
      expect(h.descendants(history)).not.toContain(panel);
      panelShapes.push(h.descendants(panel).map((n: any) => n.type));
    }
    expect(panelShapes[1]).toEqual(panelShapes[0]);
    expect(panelShapes[2]).toEqual(panelShapes[0]);
    expect(panelShapes[3]).toEqual(panelShapes[0]);
    h.states[5] = 36;
    expect(h.find(h.render(), "Người đang nói").props.style.fontSize).toBe(36);
  });

  test("only new final lines scroll while attached; detached readers keep position and jump still works", () => {
    const h = layoutHarness(); h.render();
    h.states[1] = [{id:"one",text_source:"Final one"}]; h.render();
    expect(h.history.scrollTop).toBe(2000);
    h.refs[1].current = false;
    h.history.scrollTop = 300;
    h.states[1] = [...h.states[1],{id:"two",text_source:"Final two"}];
    const tree = h.render();
    expect(h.history.scrollTop).toBe(300);
    expect(h.states[7].visible).toBe(true);
    const button = h.descendants(h.render()).find((n: any) => n.type === "button" && n.props.onClick && String(n.props.className).includes("absolute"));
    button.props.onClick();
    expect(h.history.scrollTop).toBe(2000);
    expect(h.refs[1].current).toBe(true);
    expect(h.states[7].visible).toBe(false);
  });
});

// Real React reconciliation: reading speaker_name marks execution of the row body.
// A partial/clock update must not traverse history, and an append must only render its new row.
import * as React from "react";
import { act, create } from "react-test-renderer";
import * as jsxRuntime from "react/jsx-runtime";

test("649/1001 rows skip partial ticks and only new rows render on append", () => {
  const code = ts.transpileModule(readFileSync(new URL("./CaptionsPage.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: any = {};
  new Function("require", "exports", code)((name: string) => name === "react" ? React :
    name === "react/jsx-runtime" ? jsxRuntime : name.includes("supabase/client") ? { supabase: {} } : {}, exports);
  for (const count of [649, 1001]) {
    let renders = 0, traversals = 0;
    const makeLine = (id: number) => ({ id: String(id), seq: id, source_lang: "vi", text_source: `Dòng ${id}`,
      text_vi: `Dòng ${id}`, text_en: `Line ${id}`, get speaker_name() { renders++; return null; } });
    const lines = Array.from({ length: count }, (_, i) => makeLine(i + 1));
    const observed = new Proxy(lines, { get(target, key, receiver) {
      if (key === "map") traversals++;
      return Reflect.get(target, key, receiver);
    } });
    let update: (value: number) => void = () => {};
    function Parent({ history = observed, mode = "both", fontSize = 28 }: any) {
      const [partial, setPartial] = React.useState(0);
      update = setPartial;
      return React.createElement("div", null, React.createElement(exports.CaptionHistory, {
        lines: history, mode, fontSize, status: "live",
      }), React.createElement("aside", null, String(partial)));
    }
    let root: any;
    act(() => { root = create(React.createElement(Parent)); });
    expect(renders).toBe(count);
    for (let i = 1; i <= 30; i++) act(() => update(i));
    expect(renders).toBe(count);
    expect(traversals).toBe(1);
    const appended = [...lines, makeLine(count + 1)];
    act(() => root.update(React.createElement(Parent, { history: appended })));
    expect(renders).toBe(count + 1);
    act(() => root.update(React.createElement(Parent, { history: appended, mode: "en", fontSize: 36 })));
    expect(renders).toBe(2 * (count + 1));
    expect(root.toJSON().children[0].children[0].props.style.fontSize).toBe(36);
    act(() => root.unmount());
  }
});
