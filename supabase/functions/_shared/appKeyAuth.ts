// Shared helper for validating the internal FUN Profile Application API Key.
//
// Usage in an edge function:
//   import { requireAppKey } from "../_shared/appKeyAuth.ts";
//   const unauthorized = await requireAppKey(req);
//   if (unauthorized) return unauthorized;
//
// Callers send: `Authorization: Bearer <FUN_PROFILE_APP_KEY>`.
// The token is checked first against the FUN_PROFILE_APP_KEY env var, then
// against active hashed rows in `public.app_api_keys` (for rotation overlap).
// The plaintext token is NEVER logged.

import { createClient } from "npm:@supabase/supabase-js@2";

const ENCODER = new TextEncoder();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", ENCODER.encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractBearer(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function validateAppKey(req: Request): Promise<boolean> {
  const token = extractBearer(req);
  if (!token) return false;

  const envKey = Deno.env.get("FUN_PROFILE_APP_KEY");
  if (envKey && envKey.length >= 32 && timingSafeEqual(token, envKey)) {
    return true;
  }

  // Fallback: check DB for an active hash (enables rotation overlap).
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return false;
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const hash = await sha256Hex(token);
    const { data, error } = await supabase
      .from("app_api_keys")
      .select("id")
      .eq("key_hash", hash)
      .eq("status", "active")
      .maybeSingle();
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Returns a 401 Response if the request is not authorized, or null if it is.
 */
export async function requireAppKey(req: Request): Promise<Response | null> {
  const ok = await validateAppKey(req);
  if (ok) return null;
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
