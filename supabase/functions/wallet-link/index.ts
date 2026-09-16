import { verifyMessage } from "npm:ethers@6";
import {
  corsHeaders,
  getClients,
  jsonResponse,
  logWalletAttempt,
  normalizeAddress,
  parseChainId,
  requireUser,
  validateAddress,
} from "../_shared/walletAuth.ts";

type WalletLinkRequest = {
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

  const auth = await requireUser(req);
  if ("error" in auth) {
    return auth.error;
  }

  const userId = auth.userId;
  const { adminClient } = getClients(req);

  try {
    // ── Run cooldown checks and body parse in parallel ──
    const [walletCountResult, profileResult, body] = await Promise.all([
      adminClient
        .from("user_wallets")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      adminClient
        .from("profiles")
        .select("last_wallet_changed_at")
        .eq("id", userId)
        .single(),
      req.json() as Promise<WalletLinkRequest>,
    ]);

    const walletCount = walletCountResult.count ?? 0;
    const profile = profileResult.data;

    // Cooldown 30 ngày — chỉ áp dụng khi user đã có ví liên kết
    if (walletCount > 0 && profile?.last_wallet_changed_at) {
      const lastChanged = new Date(profile.last_wallet_changed_at);
      const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
      const cooldownEnd = new Date(lastChanged.getTime() + COOLDOWN_MS);
      if (new Date() < cooldownEnd) {
        const daysLeft = Math.ceil((cooldownEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        return jsonResponse(
          { error: `Bạn cần đợi ${daysLeft} ngày nữa để thay đổi ví` },
          429,
        );
      }
    }
    const normalizedAddress = normalizeAddress(body?.address ?? "");
    const signature = (body?.signature ?? "").trim();
    const nonce = (body?.nonce ?? "").trim();
    const providedMessage = (body?.message ?? "").trim();
    const requestedChainId = parseChainId(body?.chainId);

    if (!validateAddress(normalizedAddress)) {
      // Fire-and-forget
      logWalletAttempt({
        adminClient,
        attemptType: "link",
        address: normalizedAddress,
        userId,
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
      .select("id, address, chain_id, nonce, issued_at, expires_at, used_at, requested_by_user_id")
      .eq("purpose", "link")
      .eq("nonce", nonce)
      .eq("address", normalizedAddress)
      .eq("requested_by_user_id", userId)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (nonceError) {
      console.error("[wallet-link] nonce query failed", nonceError);
      return jsonResponse({ error: "Failed to verify nonce" }, 500);
    }

    if (!nonceRow) {
      // Fire-and-forget
      logWalletAttempt({
        adminClient,
        attemptType: "link",
        address: normalizedAddress,
        userId,
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
        attemptType: "link",
        address: normalizedAddress,
        userId,
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
        attemptType: "link",
        address: normalizedAddress,
        userId,
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
        attemptType: "link",
        address: normalizedAddress,
        userId,
        success: false,
        reason: "signature_mismatch",
        req,
      });
      return jsonResponse({ error: "Signature does not match address" }, 401);
    }

    const { data: existingWallet, error: existingWalletError } = await adminClient
      .from("user_wallets")
      .select("id, user_id, is_primary, chain_id")
      .eq("address", normalizedAddress)
      .maybeSingle();

    if (existingWalletError) {
      console.error("[wallet-link] existing wallet query failed", existingWalletError);
      return jsonResponse({ error: "Failed to link wallet" }, 500);
    }

    if (existingWallet && existingWallet.user_id !== userId) {
      // Fire-and-forget
      logWalletAttempt({
        adminClient,
        attemptType: "link",
        address: normalizedAddress,
        userId,
        success: false,
        reason: "wallet_already_linked",
        req,
      });
      return jsonResponse({ error: "Wallet already linked to another account" }, 409);
    }

    const { count } = await adminClient
      .from("user_wallets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const shouldBePrimary = (count ?? 0) === 0;
    const verifiedAt = nowIso;

    let walletRecord: Record<string, unknown> | null = null;

    if (existingWallet) {
      const { data, error } = await adminClient
        .from("user_wallets")
        .update({
          chain_id: chainId,
          verified_at: verifiedAt,
          is_primary: existingWallet.is_primary || shouldBePrimary,
        })
        .eq("id", existingWallet.id)
        .select("id, user_id, address, chain_id, is_primary, verified_at, created_at")
        .single();

      if (error) {
        console.error("[wallet-link] update failed", error);
        return jsonResponse({ error: "Failed to link wallet" }, 500);
      }

      walletRecord = data;
    } else {
      const { data, error } = await adminClient
        .from("user_wallets")
        .insert({
          user_id: userId,
          address: normalizedAddress,
          chain_id: chainId,
          is_primary: shouldBePrimary,
          verified_at: verifiedAt,
        })
        .select("id, user_id, address, chain_id, is_primary, verified_at, created_at")
        .single();

      if (error) {
        if (error.code === "23505") {
          return jsonResponse({ error: "Wallet already linked to another account" }, 409);
        }
        console.error("[wallet-link] insert failed", error);
        return jsonResponse({ error: "Failed to link wallet" }, 500);
      }

      walletRecord = data;
    }

    const { error: nonceUpdateError } = await adminClient
      .from("wallet_nonces")
      .update({ used_at: nowIso })
      .eq("id", nonceRow.id);

    if (nonceUpdateError) {
      console.error("[wallet-link] mark nonce used failed", nonceUpdateError);
    }

    const { error: profileTrustError } = await adminClient
      .from("profiles")
      .update({ wallet_verified_at: nowIso })
      .eq("id", userId)
      .is("wallet_verified_at", null);

    if (profileTrustError) {
      console.error("[wallet-link] profile wallet_verified_at patch failed", profileTrustError);
    }

    // Fire-and-forget
    logWalletAttempt({
      adminClient,
      attemptType: "link",
      address: normalizedAddress,
      userId,
      success: true,
      req,
    });

    return jsonResponse({ ok: true, wallet: walletRecord });
  } catch (error) {
    console.error("[wallet-link] unhandled error", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
