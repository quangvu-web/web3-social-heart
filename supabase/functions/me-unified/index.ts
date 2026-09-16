import {
  corsHeaders,
  getClients,
  jsonResponse,
  requireUserFull,
} from "../_shared/walletAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUserFull(req);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const { userId, user } = auth;
    const { adminClient } = getClients(req);

    const [profileResult, walletsResult] = await Promise.all([
      adminClient.from("profiles").select("*").eq("id", userId).maybeSingle(),
      adminClient
        .from("user_wallets")
        .select("id, user_id, address, chain_id, is_primary, verified_at, created_at")
        .eq("user_id", userId)
        .order("is_primary", { ascending: false })
        .order("verified_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
    ]);

    if (profileResult.error) {
      return jsonResponse({ error: "Failed to load profile" }, 500);
    }

    if (walletsResult.error) {
      return jsonResponse({ error: "Failed to load wallets" }, 500);
    }

    const profile = profileResult.data;

    return jsonResponse({
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      profile,
      wallets: walletsResult.data ?? [],
      hasPassword: typeof profile?.has_password_set === "boolean" ? profile.has_password_set : null,
      providers: [],
      primaryEmail: user.email ?? null,
    });
  } catch (error) {
    console.error("[me-unified] unhandled error", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
