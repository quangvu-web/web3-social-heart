import { withAiUsageContext, captureAiUsage } from "./ai-usage-context.ts";
/**
 * Lightweight cloud usage tracker.
 * Ghi mỗi lần edge function chạy vào bảng public.cloud_usage_events để
 * admin UI (tab Cloud Usage) tổng hợp function/feature nào đang ngốn compute.
 *
 * Dùng: đặt ở đầu handler
 *   const done = startCloudUsage("telegram-community-webhook", "Angel AI · Telegram");
 *   ... work ...
 *   await done(200);
 *
 * KHÔNG throw ra ngoài — mọi lỗi tracking đều swallowed để không ảnh hưởng handler.
 */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

let clientSingleton: SupabaseClient | null = null;
function getClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  if (!clientSingleton) {
    clientSingleton = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return clientSingleton;
}

export function startCloudUsage(functionName: string, feature?: string) {
  const startedAt = Date.now();
  const aiUsage = captureAiUsage();
  return async function done(statusCode = 200, meta?: Record<string, unknown>) {
    try {
      const client = getClient();
      if (!client) return;
      const duration = Date.now() - startedAt;
      const mergedMeta = () => meta || aiUsage?.snapshot() ? { ...meta, ...aiUsage?.snapshot() } : null;
      const initialMeta = mergedMeta();
      const row = { function_name: functionName, feature: feature ?? null, duration_ms: duration, status_code: statusCode, meta: initialMeta };
      if (!aiUsage) { await client.from("cloud_usage_events").insert(row); return; }
      const { data, error } = await client.from("cloud_usage_events").insert(row).select("id").single();
      if (error || !data?.id) return;
      let lastMeta = JSON.stringify(initialMeta);
      let updates = Promise.resolve();
      const refresh = () => {
        const next = mergedMeta();
        const serialized = JSON.stringify(next);
        if (serialized === lastMeta) return;
        lastMeta = serialized;
        updates = updates.then(async () => {
          await client.from("cloud_usage_events").update({ meta: next }).eq("id", data.id);
        }).catch(() => {});
        keepUsageAlive(updates);
      };
      aiUsage.subscribe(refresh);
      refresh(); // Include attempts that happened while the initial insert was pending.

    } catch {
      // silent
    }
  };
}

/**
 * Wrap a Deno.serve handler to auto-track cloud usage.
 * Usage: Deno.serve(withUsage("angel-chat", "Angel AI · DM", async (req) => {...}))
 */
export function withUsage(
  functionName: string,
  feature: string | undefined,
  handler: (req: Request) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  return (req: Request) => withAiUsageContext(async () => {
    // Do not track CORS preflight — noise + always 200
    if (req.method === "OPTIONS") return (await handler(req)) as Response;
    const done = startCloudUsage(functionName, feature);
    let status = 200;
    try {
      const res = await handler(req);
      status = res.status;
      return res;
    } catch (err) {
      status = 500;
      throw err;
    } finally {
      keepUsageAlive(done(status));
    }
  });
}


// Retain best-effort tracking after prompt ACKs and during waitUntil tasks.
function keepUsageAlive(work: Promise<unknown>): void {
  try { (globalThis as {EdgeRuntime?:{waitUntil:(task:Promise<unknown>)=>void}}).EdgeRuntime?.waitUntil(work); }
  catch { /* Tracking must never interrupt the caller. */ }
}
