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

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

let clientSingleton: ReturnType<typeof createClient> | null = null;
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
  return async function done(statusCode = 200, meta?: Record<string, unknown>) {
    try {
      const client = getClient();
      if (!client) return;
      const duration = Date.now() - startedAt;
      await client.from("cloud_usage_events").insert({
        function_name: functionName,
        feature: feature ?? null,
        duration_ms: duration,
        status_code: statusCode,
        meta: meta ?? null,
      });
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
  return async (req: Request) => {
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
      void done(status);
    }
  };
}

