import {
  fetchRestreamChannels,
  getRestreamEnvStatus,
  json,
  requireAdmin,
  requireUser,
  restreamErrorPayload,
} from "../_shared/restream.ts";

type RequestBody = {
  action?: string;
  payload?: Record<string, unknown>;
};

function publicConnection(row: any) {
  if (!row || row.revoked_at) return { connected: false };
  return {
    connected: true,
    restream_user_id: row.restream_user_id,
    expires_at: row.expires_at,
    scopes: row.scopes ?? [],
    connected_at: row.connected_at,
    updated_at: row.updated_at,
  };
}

async function getSetupStatus(serviceClient: any) {
  const env = getRestreamEnvStatus();
  const tables: Record<string, boolean> = {};
  const tableErrors: Record<string, string> = {};
  const tableChecks: Record<string, string> = {
    restream_connections: "user_id",
    restream_channels: "id",
    restream_api_logs: "id",
    live_multistream_destinations: "id",
  };
  for (const [table, column] of Object.entries(tableChecks)) {
    const { error } = await serviceClient.from(table).select(column).limit(1);
    tables[table] = !error;
    if (error) tableErrors[table] = error.message;
  }
  const databaseOk = Object.values(tables).every(Boolean);
  return {
    ok: env.ok && databaseOk,
    function_reachable: true,
    env,
    database: {
      ok: databaseOk,
      tables,
      errors: tableErrors,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: RequestBody = {};
  try { body = await req.json(); } catch { body = {}; }
  const action = body.action || "get_connection";

  if (action === "admin_logs") {
    const auth = await requireAdmin(req);
    if (auth instanceof Response) return auth;
    const limit = Math.min(200, Math.max(1, Number(body.payload?.limit || 100)));
    const { data, error } = await auth.serviceClient
      .from("restream_api_logs")
      .select("id, live_session_id, user_id, action, method, endpoint, status_code, success, error_code, error_message, duration_ms, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return json({ success: false, error: error.message }, 500);
    const { data: destinations } = await auth.serviceClient
      .from("live_multistream_destinations")
      .select("id, live_session_id, user_id, provider, platform, display_name, status, signal_status, last_error, last_signal_at, started_at, stopped_at, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    return json({ success: true, logs: data ?? [], destinations: destinations ?? [] });
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  try {
    if (action === "setup_status") {
      const setup = await getSetupStatus(auth.serviceClient);
      return json({ success: true, setup });
    }

    if (action === "get_connection") {
      const setup = await getSetupStatus(auth.serviceClient);
      if (!setup.database.ok) {
        return json({
          success: true,
          connection: { connected: false },
          channels: [],
          setup,
          warning_code: "missing_migration",
          warning: "Restream database migration is missing. Admin must deploy migrations first.",
        });
      }
      const { data, error } = await auth.serviceClient
        .from("restream_connections")
        .select("restream_user_id, expires_at, scopes, connected_at, updated_at, revoked_at")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      const { data: channels } = await auth.serviceClient
        .from("restream_channels")
        .select("restream_channel_id, platform_id, platform, display_name, channel_url, enabled, last_synced_at")
        .eq("user_id", auth.user.id)
        .order("display_name", { ascending: true });
      return json({ success: true, connection: publicConnection(data), channels: channels ?? [] });
    }

    if (action === "refresh_channels") {
      const setup = await getSetupStatus(auth.serviceClient);
      if (!setup.env.ok) {
        return json({ ...restreamErrorPayload(new Error("Missing RESTREAM_CLIENT_ID / RESTREAM_CLIENT_SECRET / RESTREAM_REDIRECT_URI")), setup }, 500);
      }
      const channels = await fetchRestreamChannels(auth.serviceClient, auth.user.id);
      return json({ success: true, channels });
    }

    if (action === "disconnect") {
      await auth.serviceClient.from("restream_connections").update({
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("user_id", auth.user.id);
      await auth.serviceClient.from("restream_channels").delete().eq("user_id", auth.user.id);
      return json({ success: true });
    }

    if (action === "get_live_status") {
      const liveSessionId = String(body.payload?.live_session_id || "");
      if (!/^[0-9a-fA-F-]{36}$/.test(liveSessionId)) return json({ success: false, error: "Valid live_session_id is required" }, 400);
      const { data, error } = await auth.serviceClient
        .from("live_multistream_destinations")
        .select("id, platform, restream_channel_id, display_name, status, signal_status, last_error, last_signal_at, started_at, stopped_at")
        .eq("user_id", auth.user.id)
        .eq("live_session_id", liveSessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json({ success: true, destinations: data ?? [] });
    }

    return json({ success: false, error: "Unknown action" }, 400);
  } catch (error) {
    return json(restreamErrorPayload(error), 500);
  }
});
