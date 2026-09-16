import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent, x-real-ip, cf-connecting-ip",
};

export const EVM_ADDRESS_REGEX = /^0x[0-9a-f]{40}$/;

const textEncoder = new TextEncoder();

export type WalletPurpose = "link" | "login";

export type NonceMessage = {
  nonce: string;
  message: string;
  statement: string;
  issuedAt: string;
  expiresAt: string;
};

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function normalizeAddress(input: string): string {
  return input.trim().toLowerCase();
}

export function parseChainId(input: unknown): number | null {
  if (input == null) return null;
  if (typeof input === "number" && Number.isInteger(input) && input > 0) return input;
  if (typeof input === "string" && input.trim()) {
    const parsed = Number(input);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function validateAddress(address: string): boolean {
  return EVM_ADDRESS_REGEX.test(address);
}

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildWalletMessage(params: {
  purpose: WalletPurpose;
  domain: string;
  uri: string;
  address: string;
  chainId: number | null;
  nonce: string;
  issuedAt: string;
}): string {
  const statement =
    params.purpose === "link"
      ? "Link this wallet to my Fun Profile account."
      : "Sign in to Fun Profile.";

  const lines = [
    "FUN Profile",
    statement,
    `Domain: ${params.domain}`,
    `URI: ${params.uri}`,
    `Address: ${params.address}`,
    `Nonce: ${params.nonce}`,
    `IssuedAt: ${params.issuedAt}`,
  ];

  if (params.chainId) {
    lines.splice(5, 0, `ChainId: ${params.chainId}`);
  }

  return lines.join("\n");
}

export function buildNonceMessage(params: {
  purpose: WalletPurpose;
  address: string;
  chainId: number | null;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  requestUrl: string;
}): NonceMessage {
  const request = new URL(params.requestUrl);
  const domain = request.host;
  const uri = request.origin;
  const statement =
    params.purpose === "link"
      ? "Link this wallet to my Fun Profile account."
      : "Sign in to Fun Profile.";

  const message = buildWalletMessage({
    purpose: params.purpose,
    domain,
    uri,
    address: params.address,
    chainId: params.chainId,
    nonce: params.nonce,
    issuedAt: params.issuedAt,
  });

  return {
    nonce: params.nonce,
    message,
    statement,
    issuedAt: params.issuedAt,
    expiresAt: params.expiresAt,
  };
}

export function getClients(req: Request): {
  userClient: SupabaseClient;
  adminClient: SupabaseClient;
  authHeader: string | null;
} {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const authHeader = req.headers.get("Authorization");
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  return { userClient, adminClient, authHeader };
}

export async function requireUser(req: Request): Promise<{ userId: string } | { error: Response }> {
  const { userClient, authHeader } = getClients(req);

  if (!authHeader) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  return { userId: user.id };
}

export async function requireUserFull(req: Request): Promise<
  { userId: string; user: { id: string; email: string | undefined } } | { error: Response }
> {
  const { userClient, authHeader } = getClients(req);

  if (!authHeader) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  return { userId: user.id, user: { id: user.id, email: user.email } };
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  const bytes = new Uint8Array(digest);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    "0.0.0.0"
  );
}

export async function enforceRateLimit(params: {
  adminClient: SupabaseClient;
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: existing, error: fetchError } = await params.adminClient
    .from("wallet_rate_limits")
    .select("key, count, expires_at")
    .eq("key", params.key)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (fetchError) {
    console.error("[wallet-rate-limit] fetch failed", fetchError);
    return { ok: true };
  }

  if (existing && existing.count >= params.limit) {
    const retryAfterMs = Math.max(1000, new Date(existing.expires_at).getTime() - now.getTime());
    return { ok: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
  }

  const windowStart = now.toISOString();
  const expiresAt = new Date(now.getTime() + params.windowSeconds * 1000).toISOString();

  if (!existing) {
    const { error } = await params.adminClient.from("wallet_rate_limits").upsert(
      {
        key: params.key,
        count: 1,
        window_start: windowStart,
        expires_at: expiresAt,
      },
      { onConflict: "key" },
    );

    if (error) {
      console.error("[wallet-rate-limit] create failed", error);
    }

    return { ok: true };
  }

  const { error } = await params.adminClient
    .from("wallet_rate_limits")
    .update({ count: existing.count + 1 })
    .eq("key", params.key);

  if (error) {
    console.error("[wallet-rate-limit] update failed", error);
  }

  return { ok: true };
}

export async function logWalletAttempt(params: {
  adminClient: SupabaseClient;
  attemptType: "nonce" | "link" | "login";
  address?: string | null;
  userId?: string | null;
  success: boolean;
  reason?: string | null;
  req: Request;
}): Promise<void> {
  try {
    const ipRaw = clientIp(params.req);
    const uaRaw = params.req.headers.get("user-agent") ?? "unknown";

    const ipHash = await sha256Hex(ipRaw);
    const uaHash = await sha256Hex(uaRaw);

    await params.adminClient.from("wallet_auth_attempts").insert({
      attempt_type: params.attemptType,
      address: params.address ?? null,
      user_id: params.userId ?? null,
      success: params.success,
      reason: params.reason ?? null,
      ip_hash: ipHash,
      ua_hash: uaHash,
    });
  } catch (error) {
    console.error("[wallet-auth-attempt] failed", error);
  }
}
