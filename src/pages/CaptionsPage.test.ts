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
          resolve({ error: null, data: table === "caption_sessions" ? session : incremental ? [fresh, fresh] : [line] });
        },
      };
      return query;
    },
    channel() {
      const channel = {
        on() { return channel; },
        subscribe(callback: (status: string) => void) { statusCallback = callback; subscriptions++; return channel; },
      };
      return channel;
    },
    async removeChannel() { removals++; },
  };
  const react = {
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
  return { intervals, timeouts, events, states, document, cleanup, settle, status: (s: string) => statusCallback(s), get cursor() { return cursor; }, get polls() { return polls; }, get subscriptions() { return subscriptions; }, get removals() { return removals; } };
}

describe("caption recovery", () => {
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