import { verifyMessage } from "npm:ethers@6";
import {
  buildWalletMessage,
  corsHeaders,
  getClients,
  jsonResponse,
  logWalletAttempt,
  normalizeAddress,
  parseChainId,
  requireUser,
  validateAddress,
} from "../_shared/walletAuth.ts";

type WalletVerifyRequest = {
  chainId?: number | null;
  address: string;
  signature: string;
  nonce: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await requireUser(req);
  if ("error" in auth) {
    return auth.error;
  }

  const userId = auth.userId;
  const { adminClient } = getClients(req);

  try {
    const body = (await req.json()) as WalletVerifyRequest;
    const address = normalizeAddress(body?.address ?? "");
    const signature = (body?.signature ?? "").trim();
    const nonce = (body?.nonce ?? "").trim();
    const requestedChainId = parseChainId(body?.chainId);

    if (!validateAddress(address)) {
      return jsonResponse({ error: "Invalid EVM address" }, 400);
    }
    if (!signature || !nonce) {
      return jsonResponse({ error: "Missing nonce or signature" }, 400);
    }

    const nowIso = new Date().toISOString();
    const { data: nonceRow, error: nonceError } = await adminClient
      .from("wallet_nonces")
      .select("id, address, chain_id, nonce, issued_at")
      .eq("purpose", "link")
      .eq("requested_by_user_id", userId)
      .eq("nonce", nonce)
      .eq("address", address)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (nonceError || !nonceRow) {
      return jsonResponse({ error: "Nonce is invalid, expired, or already used" }, 400);
    }

    const requestUrl = new URL(req.url);
    const expectedMessage = buildWalletMessage({
      purpose: "link",
      domain: requestUrl.host,
      uri: requestUrl.origin,
      address,
      chainId: nonceRow.chain_id ?? requestedChainId,
      nonce: nonceRow.nonce,
      issuedAt: nonceRow.issued_at,
    });

    let recovered = "";
    try {
      recovered = String(verifyMessage(expectedMessage, signature)).toLowerCase();
    } catch {
      return jsonResponse({ error: "Invalid signature format" }, 401);
    }

    if (recovered !== address) {
      return jsonResponse({ error: "Signature does not match address" }, 401);
    }

    const { data: existing } = await adminClient
      .from("user_wallets")
      .select("id, user_id, is_primary")
      .eq("address", address)
      .maybeSingle();

    if (existing && existing.user_id !== userId) {
      return jsonResponse({ error: "Wallet is already linked to another account" }, 409);
    }

    const { count } = await adminClient
      .from("user_wallets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const isPrimary = (count ?? 0) === 0 || Boolean(existing?.is_primary);

    let wallet: Record<string, unknown> | null = null;

    if (existing) {
      const { data } = await adminClient
        .from("user_wallets")
        .update({ chain_id: nonceRow.chain_id ?? requestedChainId, verified_at: nowIso, is_primary: isPrimary })
        .eq("id", existing.id)
        .select("id, user_id, address, chain_id, is_primary, verified_at, created_at")
        .single();
      wallet = data;
    } else {
      const { data, error } = await adminClient
        .from("user_wallets")
        .insert({
          user_id: userId,
          address,
          chain_id: nonceRow.chain_id ?? requestedChainId,
          verified_at: nowIso,
          is_primary: isPrimary,
        })
        .select("id, user_id, address, chain_id, is_primary, verified_at, created_at")
        .single();
      if (error) {
        if (error.code === "23505") {
          return jsonResponse({ error: "Wallet is already linked to another account" }, 409);
        }
        return jsonResponse({ error: "Failed to link wallet" }, 500);
      }
      wallet = data;
    }

    await adminClient.from("wallet_nonces").update({ used_at: nowIso }).eq("id", nonceRow.id);

    // Fire-and-forget
    logWalletAttempt({
      adminClient,
      attemptType: "link",
      address,
      userId,
      success: true,
      req,
    });

    return jsonResponse({ ok: true, wallet });
  } catch (error) {
    console.error("[wallet-verify] unhandled error", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
