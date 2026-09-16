import {
  corsHeaders,
  getClients,
  jsonResponse,
  normalizeAddress,
  parseChainId,
  requireUser,
} from "../_shared/walletAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  const auth = await requireUser(req);
  if ("error" in auth) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  const { userId } = auth;
  const { adminClient } = getClients(req);

  try {
    const body = await req.json().catch(() => ({}));
    const requestedAddress =
      typeof body.address === "string" ? normalizeAddress(body.address) : null;
    const requestedChainId = parseChainId(body.chain_id ?? body.chainId);

    let query = adminClient
      .from("user_wallets")
      .select("id, address, chain_id")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false })
      .order("verified_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (requestedAddress) {
      query = query.eq("address", requestedAddress);
    }

    if (requestedChainId) {
      query = query.eq("chain_id", requestedChainId);
    }

    const { data: walletRow, error: fetchError } = await query.maybeSingle();

    if (fetchError) {
      return jsonResponse({ success: false, error: "Failed to load linked wallet" }, 500);
    }

    if (!walletRow) {
      return jsonResponse({ success: false, error: "No external wallet connected" }, 400);
    }

    const { error: deleteError } = await adminClient
      .from("user_wallets")
      .delete()
      .eq("id", walletRow.id)
      .eq("user_id", userId);

    if (deleteError) {
      return jsonResponse({ success: false, error: "Failed to disconnect wallet" }, 500);
    }

    return jsonResponse({
      success: true,
      message: "External wallet disconnected successfully",
      disconnected_address: walletRow.address,
      chain_id: walletRow.chain_id,
    });
  } catch (error) {
    console.error("[disconnect-external-wallet] unhandled", error);
    return jsonResponse({ success: false, error: "Internal server error" }, 500);
  }
});
