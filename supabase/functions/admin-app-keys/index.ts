// Admin endpoint to manage the internal FUN Profile Application API Key.
//
// Actions (POST JSON body):
//   { action: "list" }                      -> masked history
//   { action: "generate", notes? }          -> create a new key, return plaintext ONCE
//   { action: "rotate", notes? }            -> mark active as rotated and generate new key
//   { action: "revoke", id }                -> revoke a specific key
//
// Plaintext is returned ONLY in the response of generate/rotate, then discarded.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ENCODER = new TextEncoder();
const BASE62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const KEY_PREFIX = "fun_profile_live_";
const RANDOM_LEN = 58; // total >= 64

function generateKey(): string {
  const bytes = new Uint8Array(RANDOM_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < RANDOM_LEN; i++) out += BASE62[bytes[i] % 62];
  return KEY_PREFIX + out;
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", ENCODER.encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth: require a signed-in admin user.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
  const userId = claims.claims.sub as string;

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: hasRole, error: roleErr } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleErr || !hasRole) return json({ error: "Forbidden" }, 403);

  let body: { action?: string; id?: string; notes?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const action = body.action ?? "list";

  try {
    if (action === "list") {
      const { data, error } = await admin
        .from("app_api_keys")
        .select("id, key_prefix, key_last4, status, created_by, notes, created_at, rotated_at, revoked_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ keys: data ?? [] });
    }

    if (action === "generate" || action === "rotate") {
      // Mark existing active keys as rotated.
      const { error: rotErr } = await admin
        .from("app_api_keys")
        .update({ status: "rotated", rotated_at: new Date().toISOString() })
        .eq("status", "active");
      if (rotErr) throw rotErr;

      const plaintext = generateKey();
      const hash = await sha256Hex(plaintext);
      const prefix = plaintext.slice(0, 20);
      const last4 = plaintext.slice(-4);

      const { data: inserted, error: insErr } = await admin
        .from("app_api_keys")
        .insert({
          key_prefix: prefix,
          key_hash: hash,
          key_last4: last4,
          status: "active",
          created_by: userId,
          notes: body.notes ?? null,
        })
        .select("id, key_prefix, key_last4, status, created_at")
        .single();
      if (insErr) throw insErr;

      // Audit log (best-effort, no plaintext).
      await admin.from("audit_logs").insert({
        admin_id: userId,
        action: action === "generate" ? "app_key_generate" : "app_key_rotate",
        target_type: "app_api_key",
        target_id: inserted.id,
        details: { prefix, last4 },
      }).then(() => {}, () => {});

      return json({
        key: plaintext, // returned ONCE
        meta: inserted,
        instructions:
          "Copy this key now. Paste it into the FUN_PROFILE_APP_KEY secret in Lovable Cloud. It will not be shown again.",
      });
    }

    if (action === "revoke") {
      if (!body.id) return json({ error: "id required" }, 400);
      const { error } = await admin
        .from("app_api_keys")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("id", body.id);
      if (error) throw error;
      await admin.from("audit_logs").insert({
        admin_id: userId,
        action: "app_key_revoke",
        target_type: "app_api_key",
        target_id: body.id,
      }).then(() => {}, () => {});
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("admin-app-keys error", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
