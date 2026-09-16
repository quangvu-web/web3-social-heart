// Admin endpoint to list/export all FUN Profile users.
// Actions (POST JSON body):
//   { action: "list", search?, limit?, offset? } -> paginated list with auth emails
//   { action: "export" }                          -> all users (no pagination), no secrets

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  let body: { action?: string; search?: string; limit?: number; offset?: number } = {};
  try { body = await req.json(); } catch { body = {}; }
  const action = body.action ?? "list";

  try {
    // Build profile query
    const search = (body.search ?? "").trim();
    const limit = action === "export" ? 50000 : Math.min(Math.max(body.limit ?? 50, 1), 500);
    const offset = action === "export" ? 0 : Math.max(body.offset ?? 0, 0);

    let q = admin.from("profiles").select("*", { count: "exact" });
    if (search) {
      const s = search.replace(/[%,]/g, "");
      q = q.or(`username.ilike.%${s}%,full_name.ilike.%${s}%,email_claimed.ilike.%${s}%`);
    }
    q = q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data: profiles, error: profErr, count } = await q;
    if (profErr) throw profErr;

    const ids = (profiles ?? []).map((p: any) => p.id);

    // Fetch auth emails + last_sign_in via admin.listUsers (paginate)
    const authMap = new Map<string, { email: string | null; last_sign_in_at: string | null; auth_created_at: string | null; providers: string[] }>();
    if (ids.length > 0) {
      // listUsers paginates max 1000/page
      let page = 1;
      const perPage = 1000;
      while (true) {
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage });
        if (listErr) break;
        for (const u of list.users) {
          authMap.set(u.id, {
            email: u.email ?? null,
            last_sign_in_at: u.last_sign_in_at ?? null,
            auth_created_at: u.created_at ?? null,
            providers: (u.app_metadata?.providers as string[]) ?? [],
          });
        }
        if (list.users.length < perPage) break;
        page++;
        if (page > 50) break; // hard safety cap (50k users)
      }
    }

    // Fetch wallets
    const walletsByUser = new Map<string, any[]>();
    if (ids.length > 0) {
      const { data: wallets } = await admin
        .from("user_wallets")
        .select("user_id, address, chain_id, is_primary, verified_at, created_at")
        .in("user_id", ids);
      for (const w of wallets ?? []) {
        const arr = walletsByUser.get(w.user_id) ?? [];
        arr.push(w);
        walletsByUser.set(w.user_id, arr);
      }
    }

    const rows = (profiles ?? []).map((p: any) => {
      const a = authMap.get(p.id);
      return {
        ...p,
        email: a?.email ?? p.email_claimed ?? null,
        auth_providers: a?.providers ?? [],
        last_sign_in_at: a?.last_sign_in_at ?? null,
        auth_created_at: a?.auth_created_at ?? null,
        linked_wallets: walletsByUser.get(p.id) ?? [],
      };
    });

    if (action === "export") {
      await admin.from("audit_logs").insert({
        admin_id: userId,
        action: "users_export",
        target_type: "users",
        details: { count: rows.length },
      }).then(() => {}, () => {});
    }

    return json({ users: rows, total: count ?? rows.length });
  } catch (e) {
    console.error("admin-users-export error", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
