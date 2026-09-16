import {
  createServiceClient,
  createStateHash,
  exchangeCodeForTokens,
  fetchRestreamProfile,
  json,
  logRestreamApi,
  requireRestreamEnv,
  saveConnection,
} from "../_shared/restream.ts";

function redirect(location: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: location },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const appUrl = (Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "").replace(/\/+$/, "");
  const fallbackRedirect = `${appUrl || "https://funprofile.camly.co"}/live/new?restream=error`;
  try {
    requireRestreamEnv();
    const url = new URL(req.url);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    if (!code || !state) return redirect(fallbackRedirect);

    const serviceClient = createServiceClient();
    const stateHash = await createStateHash(state);
    const { data: stateRow, error: stateError } = await serviceClient
      .from("restream_oauth_states")
      .select("id, user_id, redirect_after, expires_at, used_at")
      .eq("state_hash", stateHash)
      .maybeSingle();
    if (stateError) throw stateError;
    if (!stateRow || stateRow.used_at || new Date(String(stateRow.expires_at)).getTime() < Date.now()) {
      return redirect(fallbackRedirect);
    }

    const exchanged = await exchangeCodeForTokens(code);
    await serviceClient.from("restream_oauth_states").update({ used_at: new Date().toISOString() }).eq("id", stateRow.id);
    await saveConnection(serviceClient, String(stateRow.user_id), null, exchanged.tokens);
    await logRestreamApi(serviceClient, {
      userId: String(stateRow.user_id),
      action: "oauth_code_exchange",
      method: "POST",
      endpoint: "/oauth/token",
      statusCode: exchanged.status,
      success: true,
      durationMs: exchanged.durationMs,
      details: { scopes: exchanged.tokens.scopes },
    });

    try {
      const profile = await fetchRestreamProfile(serviceClient, String(stateRow.user_id));
      await serviceClient.from("restream_connections").update({
        restream_user_id: profile?.id ? String(profile.id) : null,
        updated_at: new Date().toISOString(),
      }).eq("user_id", String(stateRow.user_id));
    } catch {
      // Profile is nice to have; the token connection is already valid.
    }

    const redirectAfter = String(stateRow.redirect_after || "/live/new").startsWith("/")
      ? String(stateRow.redirect_after || "/live/new")
      : "/live/new";
    return redirect(`${appUrl || "https://funprofile.camly.co"}${redirectAfter}${redirectAfter.includes("?") ? "&" : "?"}restream=connected`);
  } catch (error) {
    console.error("[restream-oauth-callback] failed", error);
    return redirect(fallbackRedirect);
  }
});
