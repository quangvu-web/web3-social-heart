import { AsyncLocalStorage } from "node:async_hooks";
import type { AiProvider } from "./ai-provider.ts";
interface UsageContext { counts: Map<AiProvider, number>; listeners: Set<() => void> }
const usage = new AsyncLocalStorage<UsageContext>();
export function withAiUsageContext<T>(work: () => T): T { return usage.run({counts:new Map(),listeners:new Set()}, work); }
export function recordAiAttempt(provider: AiProvider): void {
  const context = usage.getStore();
  if (!context) return;
  context.counts.set(provider, (context.counts.get(provider) ?? 0) + 1);
  for (const listener of context.listeners) { try { listener(); } catch { /* Observability must not interrupt AI. */ } }
}
function snapshot(context?: UsageContext): Record<string, unknown> | undefined {
  if (!context?.counts.size) return undefined;
  const providers = [...context.counts.keys()].sort();
  return { provider: providers.length === 1 ? providers[0] : "mixed", ai_providers: providers, ai_attempts: Object.fromEntries(context.counts) };
}
export function aiUsageMeta(): Record<string, unknown> | undefined { return snapshot(usage.getStore()); }
// Capture the request's own store so later waitUntil work updates the same event.
export function captureAiUsage() {
  const context = usage.getStore();
  return context ? { snapshot: () => snapshot(context), subscribe: (listener:()=>void) => context.listeners.add(listener) } : undefined;
}
