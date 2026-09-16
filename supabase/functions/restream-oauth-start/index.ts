import { createStateHash, getRestreamEnvStatus, json, requireRestreamEnv, requireUser, restreamErrorPayload } from "../_shared/restream.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  try {
    const setup = getRestreamEnvStatus();
    if (!setup.ok) {
      return json({
        ...restreamErrorPayload(new Error(setup.missing.includes("RESTREAM_TOKEN_ENCRYPTION_SECRET") ? "RESTREAM_TOKEN_ENCRYPTION_SECRET must be configured with at least 32 characters" : "Missing RESTREAM_CLIENT_ID / RESTREAM_CLIENT_SECRET / RESTREAM_REDIRECT_URI")),
        setup,
      }, 500);
    }
    const { clientId, redirectUri } = requireRestreamEnv();
    const body = await req.json().catch(() => ({}));
    const redirectAfter = typeof body.redirect_after === "string" ? body.redirect_after.slice(0, 300) : "/live/studio";
    const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const stateHash = await createStateHash(state);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await auth.serviceClient.from("restream_oauth_states").insert({
      user_id: auth.user.id,
      state_hash: stateHash,
      redirect_after: redirectAfter,
      expires_at: expiresAt,
    });
    if (error) throw error;

    const url = new URL("https://api.restream.io/login");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);

    return json({ success: true, auth_url: url.toString(), expires_at: expiresAt });
  } catch (error) {
    return json(restreamErrorPayload(error, "Unable to start Restream OAuth"), 500);
  }
});
