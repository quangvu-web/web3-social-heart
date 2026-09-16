import { verifyMessage } from "npm:ethers@6";
import {
  buildWalletMessage,
  corsHeaders,
  getClients,
  jsonResponse,
  logWalletAttempt,
  normalizeAddress,
  parseChainId,
  validateAddress,
} from "../_shared/walletAuth.ts";

type WalletLoginRequest = {
  address: string;
  signature: string;
  message: string;
  nonce: string;
  chainId?: number | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const { adminClient } = getClients(req);

  try {
    const body = (await req.json()) as WalletLoginRequest;
    const normalizedAddress = normalizeAddress(body?.address ?? "");
    const signature = (body?.signature ?? "").trim();
    const nonce = (body?.nonce ?? "").trim();
    const providedMessage = (body?.message ?? "").trim();
    const requestedChainId = parseChainId(body?.chainId);

    if (!validateAddress(normalizedAddress)) {
      // Fire-and-forget
      logWalletAttempt({
        adminClient,
        attemptType: "login",
        address: normalizedAddress,
        success: false,
        reason: "invalid_address",
        req,
      });
      return jsonResponse({ error: "Invalid EVM address" }, 400);
    }

    if (!signature || !nonce || !providedMessage) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    const nowIso = new Date().toISOString();
    const { data: nonceRow, error: nonceError } = await adminClient
      .from("wallet_nonces")
      .select("id, address, chain_id, nonce, issued_at, expires_at, used_at")
      .eq("purpose", "login")
      .eq("nonce", nonce)
      .eq("address", normalizedAddress)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (nonceError) {
      console.error("[wallet-login] nonce query failed", nonceError);
      return jsonResponse({ error: "Failed to verify nonce" }, 500);
    }

    if (!nonceRow) {
      // Fire-and-forget
      logWalletAttempt({
        adminClient,
        attemptType: "login",
        address: normalizedAddress,
        success: false,
        reason: "nonce_invalid",
        req,
      });
      return jsonResponse({ error: "Nonce is invalid, expired, or already used" }, 400);
    }

    const chainId = nonceRow.chain_id ?? requestedChainId;

    if (!providedMessage.includes(nonceRow.nonce) || !providedMessage.includes(normalizedAddress)) {
      // Fire-and-forget
      logWalletAttempt({
        adminClient,
        attemptType: "login",
        address: normalizedAddress,
        success: false,
        reason: "message_mismatch",
        req,
      });
      return jsonResponse({ error: "Message mismatch" }, 400);
    }

    let recoveredAddress = "";
    try {
      recoveredAddress = String(verifyMessage(providedMessage, signature)).toLowerCase();
    } catch {
      // Fire-and-forget
      logWalletAttempt({
        adminClient,
        attemptType: "login",
        address: normalizedAddress,
        success: false,
        reason: "signature_invalid",
        req,
      });
      return jsonResponse({ error: "Invalid signature" }, 401);
    }

    if (recoveredAddress !== normalizedAddress) {
      // Fire-and-forget
      logWalletAttempt({
        adminClient,
        attemptType: "login",
        address: normalizedAddress,
        success: false,
        reason: "signature_mismatch",
        req,
      });
      return jsonResponse({ error: "Signature does not match address" }, 401);
    }

    const { data: walletRow, error: walletError } = await adminClient
      .from("user_wallets")
      .select("id, user_id, address")
      .eq("address", normalizedAddress)
      .maybeSingle();

    if (walletError) {
      console.error("[wallet-login] wallet query failed", walletError);
      return jsonResponse({ error: "Unable to resolve wallet account" }, 500);
    }

    if (!walletRow) {
      // Fire-and-forget
      logWalletAttempt({
        adminClient,
        attemptType: "login",
        address: normalizedAddress,
        success: false,
        reason: "wallet_not_linked",
        req,
      });
      return jsonResponse({ ok: false, code: "wallet_not_linked", error: "Wallet is not linked to any account" }, 200);
    }

    const userLookup = await adminClient.auth.admin.getUserById(walletRow.user_id);
    const primaryEmail = userLookup.data.user?.email;

    if (!primaryEmail) {
      // Fire-and-forget
      logWalletAttempt({
        adminClient,
        attemptType: "login",
        address: normalizedAddress,
        userId: walletRow.user_id,
        success: false,
        reason: "email_not_found",
        req,
      });
      return jsonResponse({ error: "Account email not found for wallet login" }, 500);
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: primaryEmail,
    });

    if (linkError) {
      console.error("[wallet-login] generate link failed", linkError);
      // Fire-and-forget
      logWalletAttempt({
        adminClient,
        attemptType: "login",
        address: normalizedAddress,
        userId: walletRow.user_id,
        success: false,
        reason: "generate_link_failed",
        req,
      });
      return jsonResponse({ error: "Failed to issue session bootstrap" }, 500);
    }

    const { error: nonceUpdateError } = await adminClient
      .from("wallet_nonces")
      .update({ used_at: nowIso })
      .eq("id", nonceRow.id);

    if (nonceUpdateError) {
      console.error("[wallet-login] mark nonce used failed", nonceUpdateError);
    }

    // Fire-and-forget
    logWalletAttempt({
      adminClient,
      attemptType: "login",
      address: normalizedAddress,
      userId: walletRow.user_id,
      success: true,
      req,
    });

    return jsonResponse({
      ok: true,
      user_id: walletRow.user_id,
      auth: {
        token_hash: linkData?.properties?.hashed_token ?? null,
        email: primaryEmail,
      },
    });
  } catch (error) {
    console.error("[wallet-login] unhandled error", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
