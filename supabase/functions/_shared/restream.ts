import { createClient } from "npm:@supabase/supabase-js@2";
import { decryptSecret, encryptSecret, sha256Hex } from "./genericCrypto.ts";

export const restreamCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...restreamCorsHeaders, "Content-Type": "application/json" },
  });
}

export type SupabaseClient = ReturnType<typeof createClient>;

export interface AuthContext {
  user: { id: string };
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
}

export interface RestreamTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scopes: string[];
}

const RESTREAM_API_BASE = "https://api.restream.io/v2";
const RESTREAM_TOKEN_URL = "https://api.restream.io/oauth/token";
const TOKEN_SECRET_ENV = "RESTREAM_TOKEN_ENCRYPTION_SECRET";
const PLATFORM_BY_ID: Record<number, string> = {
  1: "youtube",
  5: "twitch",
  6: "facebook",
  13: "facebook",
  29: "custom",
  73: "instagram",
};

function inferPlatform(channel: any, platformId: number | null): string {
  if (platformId && PLATFORM_BY_ID[platformId]) return PLATFORM_BY_ID[platformId];
  const text = `${channel.platform || ""} ${channel.platformName || ""} ${channel.displayName || ""} ${channel.channelUrl || ""}`.toLowerCase();
  if (text.includes("youtube") || text.includes("youtu.be")) return "youtube";
  if (text.includes("facebook") || text.includes("fb.com")) return "facebook";
  if (text.includes("twitch")) return "twitch";
  if (text.includes("instagram")) return "instagram";
  return "unknown";
}

export function requireRestreamEnv() {
  const clientId = (Deno.env.get("RESTREAM_CLIENT_ID") || "").trim();
  const clientSecret = (Deno.env.get("RESTREAM_CLIENT_SECRET") || "").trim();
  const redirectUri = (Deno.env.get("RESTREAM_REDIRECT_URI") || "").trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing RESTREAM_CLIENT_ID / RESTREAM_CLIENT_SECRET / RESTREAM_REDIRECT_URI");
  }
  return { clientId, clientSecret, redirectUri };
}

export function getRestreamEnvStatus() {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const redirectUri = (Deno.env.get("RESTREAM_REDIRECT_URI") || "").trim();
  const tokenSecret = (Deno.env.get(TOKEN_SECRET_ENV) || "").trim();
  const status = {
    restream_client_id: Boolean((Deno.env.get("RESTREAM_CLIENT_ID") || "").trim()),
    restream_client_secret: Boolean((Deno.env.get("RESTREAM_CLIENT_SECRET") || "").trim()),
    restream_redirect_uri: Boolean(redirectUri),
    restream_token_encryption_secret: tokenSecret.length >= 32,
    redirect_uri: redirectUri || null,
    expected_callback_url: supabaseUrl ? `${supabaseUrl}/functions/v1/restream-oauth-callback` : null,
    agora_egress_configured: Boolean((Deno.env.get("AGORA_RTMP_EGRESS_API_URL") || Deno.env.get("AGORA_RTMP_CONVERTER_PATH") || "").trim()),
  };
  const missing = Object.entries(status)
    .filter(([key, value]) => key.startsWith("restream_") && value !== true)
    .map(([key]) => key.toUpperCase());
  return {
    ...status,
    ok: missing.length === 0,
    missing,
  };
}

export function restreamErrorPayload(error: unknown, fallback = "Restream API failed") {
  const message = error instanceof Error ? error.message : fallback;
  const lower = message.toLowerCase();
  if (lower.includes("could not find the table") || lower.includes("schema cache") || lower.includes("relation") || lower.includes("does not exist")) {
    return {
      success: false,
      error: "Restream database migration is missing. Please deploy migrations first.",
      error_code: "missing_migration",
    };
  }
  if (message.includes("RESTREAM_CLIENT_ID") || message.includes("RESTREAM_CLIENT_SECRET") || message.includes("RESTREAM_REDIRECT_URI")) {
    return {
      success: false,
      error: "Restream backend env is missing. Admin must configure RESTREAM_CLIENT_ID, RESTREAM_CLIENT_SECRET, and RESTREAM_REDIRECT_URI.",
      error_code: "missing_restream_env",
    };
  }
  if (message.includes(TOKEN_SECRET_ENV)) {
    return {
      success: false,
      error: "Restream token encryption secret is missing or too short. Admin must configure RESTREAM_TOKEN_ENCRYPTION_SECRET with at least 32 characters.",
      error_code: "missing_encryption_secret",
    };
  }
  if (message === "Restream is not connected") {
    return {
      success: false,
      error: message,
      error_code: "not_connected",
    };
  }
  return {
    success: false,
    error: message || fallback,
    error_code: "restream_api_failed",
  };
}

export function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase service configuration missing");
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function requireUser(req: Request): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authorization required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Supabase configuration missing" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return json({ error: "Invalid token" }, 401);
  return { user: { id: user.id }, userClient, serviceClient };
}

export async function requireAdmin(req: Request): Promise<AuthContext | Response> {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { data, error } = await auth.serviceClient.rpc("has_role", {
    _user_id: auth.user.id,
    _role: "admin",
  });
  if (error || data !== true) return json({ error: "Admin access required" }, 403);
  return auth;
}

export async function logRestreamApi(
  client: SupabaseClient,
  input: {
    userId?: string | null;
    liveSessionId?: string | null;
    action: string;
    method?: string;
    endpoint?: string;
    statusCode?: number | null;
    success: boolean;
    errorCode?: string | null;
    errorMessage?: string | null;
    durationMs?: number | null;
    details?: Record<string, unknown>;
  },
) {
  await client.from("restream_api_logs").insert({
    user_id: input.userId ?? null,
    live_session_id: input.liveSessionId ?? null,
    action: input.action,
    method: input.method ?? null,
    endpoint: input.endpoint ?? null,
    status_code: input.statusCode ?? null,
    success: input.success,
    error_code: input.errorCode ?? null,
    error_message: input.errorMessage ? input.errorMessage.slice(0, 500) : null,
    duration_ms: input.durationMs ?? null,
    details: input.details ?? {},
  });
}

function parseScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") return raw.split(/\s+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeTokenSet(body: any): RestreamTokenSet {
  const accessToken = String(body.access_token || body.accessToken || "");
  const refreshToken = String(body.refresh_token || body.refreshToken || "");
  const expiresIn = Number(body.expires_in || body.accessTokenExpiresIn || 3600);
  const expiresAt =
    typeof body.accessTokenExpiresAt === "string"
      ? body.accessTokenExpiresAt
      : new Date(Date.now() + Math.max(60, expiresIn) * 1000).toISOString();
  if (!accessToken || !refreshToken) throw new Error("Restream token response is missing tokens");
  return { accessToken, refreshToken, expiresAt, scopes: parseScopes(body.scopeJson || body.scope) };
}

async function tokenRequest(payload: URLSearchParams) {
  const { clientId, clientSecret } = requireRestreamEnv();
  const started = Date.now();
  const res = await fetch(RESTREAM_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: payload,
  });
  const raw = await res.text();
  let body: any = {};
  try { body = JSON.parse(raw); } catch { body = { raw }; }
  return { res, body, durationMs: Date.now() - started };
}

export async function exchangeCodeForTokens(code: string): Promise<{ tokens: RestreamTokenSet; status: number; durationMs: number; body: any }> {
  const { redirectUri } = requireRestreamEnv();
  const payload = new URLSearchParams();
  payload.set("grant_type", "authorization_code");
  payload.set("redirect_uri", redirectUri);
  payload.set("code", code);
  const result = await tokenRequest(payload);
  if (!result.res.ok) throw new Error(result.body?.error?.message || "Restream code exchange failed");
  return { tokens: normalizeTokenSet(result.body), status: result.res.status, durationMs: result.durationMs, body: result.body };
}

export async function refreshTokens(refreshToken: string): Promise<{ tokens: RestreamTokenSet; status: number; durationMs: number; body: any }> {
  const payload = new URLSearchParams();
  payload.set("grant_type", "refresh_token");
  payload.set("refresh_token", refreshToken);
  const result = await tokenRequest(payload);
  if (!result.res.ok) throw new Error(result.body?.error?.message || "Restream token refresh failed");
  return { tokens: normalizeTokenSet(result.body), status: result.res.status, durationMs: result.durationMs, body: result.body };
}

export async function saveConnection(client: SupabaseClient, userId: string, restreamUserId: string | null, tokens: RestreamTokenSet) {
  const payload: Record<string, unknown> = {
    user_id: userId,
    access_token_encrypted: await encryptSecret(tokens.accessToken, TOKEN_SECRET_ENV),
    refresh_token_encrypted: await encryptSecret(tokens.refreshToken, TOKEN_SECRET_ENV),
    expires_at: tokens.expiresAt,
    scopes: tokens.scopes,
    revoked_at: null,
    updated_at: new Date().toISOString(),
  };
  if (restreamUserId !== null) payload.restream_user_id = restreamUserId;
  await client.from("restream_connections").upsert(payload, { onConflict: "user_id" });
}

export async function getValidAccessToken(client: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await client
    .from("restream_connections")
    .select("access_token_encrypted, refresh_token_encrypted, expires_at, revoked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.revoked_at) throw new Error("Restream is not connected");

  const expiresAt = new Date(String(data.expires_at)).getTime();
  if (expiresAt > Date.now() + 2 * 60 * 1000) {
    return await decryptSecret(String(data.access_token_encrypted), TOKEN_SECRET_ENV);
  }

  const refreshToken = await decryptSecret(String(data.refresh_token_encrypted), TOKEN_SECRET_ENV);
  const refreshed = await refreshTokens(refreshToken);
  await saveConnection(client, userId, null, refreshed.tokens);
  await logRestreamApi(client, {
    userId,
    action: "token_refresh",
    method: "POST",
    endpoint: "/oauth/token",
    statusCode: refreshed.status,
    success: true,
    durationMs: refreshed.durationMs,
  });
  return refreshed.tokens.accessToken;
}

export async function restreamApi(
  client: SupabaseClient,
  userId: string,
  method: "GET" | "POST" | "DELETE",
  endpoint: string,
  action: string,
  body?: unknown,
  liveSessionId?: string | null,
) {
  const token = await getValidAccessToken(client, userId);
  const started = Date.now();
  const res = await fetch(`${RESTREAM_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let data: any = {};
  try { data = JSON.parse(raw); } catch { data = { raw }; }
  await logRestreamApi(client, {
    userId,
    liveSessionId,
    action,
    method,
    endpoint,
    statusCode: res.status,
    success: res.ok,
    errorCode: res.ok ? null : String(data?.error?.code || res.status),
    errorMessage: res.ok ? null : String(data?.error?.message || raw || "Restream request failed"),
    durationMs: Date.now() - started,
  });
  if (!res.ok) throw new Error(data?.error?.message || "Restream request failed");
  return data;
}

export async function fetchRestreamProfile(client: SupabaseClient, userId: string) {
  return await restreamApi(client, userId, "GET", "/user/profile", "profile_get");
}

export async function fetchRestreamChannels(client: SupabaseClient, userId: string) {
  const body = await restreamApi(client, userId, "GET", "/user/channels", "channels_get");
  const channels = Array.isArray(body?.channels) ? body.channels : [];
  const normalized = channels.map((channel: any) => {
    const platformId = Number(channel.platformId ?? channel.platform_id ?? 0) || null;
    const platform = inferPlatform(channel, platformId);
    return {
      restream_channel_id: String(channel.id),
      platform_id: platformId,
      platform,
      display_name: channel.displayName || channel.display_name || channel.channelUrl || platform,
      channel_url: channel.channelUrl || channel.channel_url || null,
      enabled: channel.enabled !== false,
      raw: channel,
    };
  });

  for (const channel of normalized) {
    await client.from("restream_channels").upsert({
      user_id: userId,
      ...channel,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,restream_channel_id" });
  }
  return normalized;
}

export async function getRestreamIngest(client: SupabaseClient, userId: string) {
  const ingest = await restreamApi(client, userId, "GET", "/user/ingest", "selected_ingest_get");
  const servers = await restreamApi(client, userId, "GET", "/server/all", "ingest_servers_get");
  const streamKey = await restreamApi(client, userId, "GET", "/user/streamKey", "stream_key_get");
  const ingestId = String(ingest?.ingestId ?? "");
  const serverList = Array.isArray(servers) ? servers : [];
  const selected = serverList.find((server: any) => String(server.id) === ingestId) || serverList.find((server: any) => Number(server.id) === 20) || serverList[0];
  const rtmpUrl = String(selected?.rtmpUrl || "rtmp://live.restream.io/live");
  const key = String(streamKey?.streamKey || "");
  if (!key) throw new Error("Restream stream key is not available");
  return { ingestId, rtmpUrl, streamKey: key, server: selected ?? null };
}

export async function createStateHash(state: string) {
  return await sha256Hex(state);
}
