import { verifyMessage } from "npm:ethers@6";
import {
  corsHeaders,
  getClients,
  jsonResponse,
  logWalletAttempt,
  normalizeAddress,
  parseChainId,
  sha256Hex,
  validateAddress,
} from "../_shared/walletAuth.ts";
import { createTelegramChallenge } from "../_shared/telegram.ts";

type SiweVerifyRequest = {
  address: string;
  signature: string;
  message: string;
  nonce: string;
  chainId?: number | null;
};

const VERIFY_RATE_LIMIT = 30;
const VERIFY_RATE_WINDOW_MS = 5 * 60 * 1000;
const AUTH_CHAIN_ID = 56;

function randomPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", code: "method_not_allowed" }, 405);
  }

  try {
    const { adminClient } = getClients(req);
    const body = (await req.json()) as SiweVerifyRequest;

    const address = normalizeAddress(body?.address ?? "");
    const signature = (body?.signature ?? "").trim();
    const message = (body?.message ?? "").trim();
    const nonce = (body?.nonce ?? "").trim();
    const requestedChainId = parseChainId(body?.chainId) ?? AUTH_CHAIN_ID;

    if (!validateAddress(address)) {
      void logWalletAttempt({
        adminClient,
        attemptType: "login",
        address,
        success: false,
        reason: "invalid_address",
        req,
      });
      return jsonResponse({ error: "Invalid EVM address", code: "invalid_address" }, 400);
    }

    if (requestedChainId !== AUTH_CHAIN_ID) {
      return jsonResponse({ error: "Wrong chain", code: "wrong_chain", expectedChainId: AUTH_CHAIN_ID }, 400);
    }

    if (!signature || !message || !nonce) {
      void logWalletAttempt({
        adminClient,
        attemptType: "login",
        address,
        success: false,
        reason: "missing_fields",
        req,
      });
      return jsonResponse({ error: "Missing required fields", code: "missing_fields" }, 400);
    }

    const ipRaw = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
    const ipHash = await sha256Hex(ipRaw.split(",")[0]?.trim() ?? "0.0.0.0");
    const rateKey = `siwe_verify:${ipHash}:${address}`;

    const { data: rateLimitData } = await adminClient.rpc("check_rate_limit", {
      p_key: rateKey,
      p_limit: VERIFY_RATE_LIMIT,
      p_window_ms: VERIFY_RATE_WINDOW_MS,
    });

    if (rateLimitData && !rateLimitData.allowed) {
      void logWalletAttempt({
        adminClient,
        attemptType: "login",
        address,
        success: false,
        reason: "rate_limited",
        req,
      });
      return jsonResponse({ error: "Too many requests. Please try again later.", code: "rate_limited" }, 429);
    }

    const nowIso = new Date().toISOString();
    const { data: nonceRow, error: nonceError } = await adminClient
      .from("siwe_nonces")
      .select("id, address, nonce, expires_at, used_at, created_at")
      .eq("address", address)
      .eq("nonce", nonce)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (nonceError) {
      console.error("[siwe-verify] nonce query failed", nonceError);
      return jsonResponse({ error: "Failed to verify nonce", code: "nonce_lookup_failed" }, 500);
    }

    if (!nonceRow) {
      void logWalletAttempt({
        adminClient,
        attemptType: "login",
        address,
        success: false,
        reason: "nonce_invalid",
        req,
      });
      return jsonResponse({ error: "Nonce is invalid, expired, or already used", code: "nonce_invalid" }, 400);
    }

    const reqUrl = new URL(req.url);
    const expectedFragments = [
      "Sign in to Fun Profile.",
      `Domain: ${reqUrl.host}`,
      `URI: ${reqUrl.origin}`,
      `Address: ${address}`,
      `ChainId: ${AUTH_CHAIN_ID}`,
      `Nonce: ${nonce}`,
    ];

    if (!expectedFragments.every((fragment) => message.includes(fragment))) {
      void logWalletAttempt({
        adminClient,
        attemptType: "login",
        address,
        success: false,
        reason: "message_mismatch",
        req,
      });
      return jsonResponse({ error: "Message mismatch", code: "verification_failed" }, 400);
    }

    let recoveredAddress = "";
    try {
      recoveredAddress = String(verifyMessage(message, signature)).toLowerCase();
    } catch (error) {
      console.error("[siwe-verify] verifyMessage failed", error);
      void logWalletAttempt({
        adminClient,
        attemptType: "login",
        address,
        success: false,
        reason: "signature_invalid",
        req,
      });
      return jsonResponse({ error: "Invalid signature", code: "verification_failed" }, 401);
    }

    if (recoveredAddress !== address) {
      void logWalletAttempt({
        adminClient,
        attemptType: "login",
        address,
        success: false,
        reason: "signature_mismatch",
        req,
      });
      return jsonResponse({ error: "Signature does not match address", code: "verification_failed" }, 401);
    }

    const { error: markUsedError } = await adminClient.from("siwe_nonces").update({ used_at: nowIso }).eq("id", nonceRow.id);
    if (markUsedError) {
      console.error("[siwe-verify] mark nonce used failed", markUsedError);
      return jsonResponse({ error: "Failed to consume nonce", code: "nonce_consume_failed" }, 500);
    }

    const { data: existingWallet, error: existingWalletError } = await adminClient
      .from("user_wallets")
      .select("id, user_id, is_primary")
      .eq("address", address)
      .maybeSingle();

    if (existingWalletError) {
      console.error("[siwe-verify] existing wallet query failed", existingWalletError);
      return jsonResponse({ error: "Failed to resolve wallet ownership", code: "wallet_lookup_failed" }, 500);
    }

    let userId = existingWallet?.user_id ?? null;
    let isNewUser = false;

    if (!userId) {
      isNewUser = true;
      const placeholderEmail = `wallet+${address}@wallet.fun.local`;

      const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
        email: placeholderEmail,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: {
          wallet_address: address,
          registered_from: "Wallet",
          oauth_provider: "Wallet",
        },
      });

      if (createUserError || !createdUser?.user) {
        console.error("[siwe-verify] create wallet-first user failed", createUserError);
        return jsonResponse({ error: "Failed to create wallet-first account", code: "user_create_failed" }, 500);
      }

      userId = createdUser.user.id;

      const { error: profileUpdateError } = await adminClient.from("profiles").upsert(
        {
          id: userId,
          trust_level: 0,
          wallet_verified_at: nowIso,
          registered_from: "Wallet",
          oauth_provider: "Wallet",
          email_claimed: null,
          email_verified_at: null,
        },
        { onConflict: "id" },
      );

      if (profileUpdateError) {
        console.error("[siwe-verify] profile update failed", profileUpdateError);
      }

      const { error: walletInsertError } = await adminClient.from("user_wallets").insert({
        user_id: userId,
        address,
        chain_id: AUTH_CHAIN_ID,
        is_primary: true,
        verified_at: nowIso,
      });

      if (walletInsertError) {
        console.error("[siwe-verify] wallet insert failed", walletInsertError);
        return jsonResponse({ error: "Failed to link wallet to new account", code: "wallet_insert_failed" }, 500);
      }
    } else {
      const { error: profilePatchError } = await adminClient
        .from("profiles")
        .update({ wallet_verified_at: nowIso })
        .eq("id", userId)
        .is("wallet_verified_at", null);

      if (profilePatchError) {
        console.error("[siwe-verify] profile wallet_verified_at patch failed", profilePatchError);
      }
    }

    const userInfo = await adminClient.auth.admin.getUserById(userId);
    const authEmail = userInfo.data.user?.email;
    if (!authEmail) {
      return jsonResponse({ error: "Cannot resolve user email", code: "user_email_missing" }, 500);
    }

    // Telegram 2FA gating — only issue session bootstrap if 2FA is not enabled.
    const telegramChallenge = await createTelegramChallenge({
      adminClient,
      userId,
      firstFactor: "wallet",
    });

    if (telegramChallenge.ok) {
      void logWalletAttempt({
        adminClient,
        attemptType: "login",
        address,
        userId,
        success: true,
        reason: "telegram_2fa_pending",
        req,
      });
      return jsonResponse({
        ok: true,
        code: "ok",
        requires_telegram_2fa: true,
        challenge_id: telegramChallenge.challengeId,
        expires_in_seconds: telegramChallenge.expiresInSeconds,
        user_id: userId,
        isNewUser,
        needsEmailVerification: isNewUser,
      });
    }

    if (telegramChallenge.code !== "not_enabled") {
      void logWalletAttempt({
        adminClient,
        attemptType: "login",
        address,
        userId,
        success: false,
        reason: `telegram_${telegramChallenge.code}`,
        req,
      });
      return jsonResponse(
        { error: telegramChallenge.error, code: telegramChallenge.code },
        telegramChallenge.code === "rate_limited" ? 429 : 500,
      );
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: authEmail,
    });

    if (linkError) {
      console.error("[siwe-verify] generate link failed", linkError);
      void logWalletAttempt({
        adminClient,
        attemptType: "login",
        address,
        userId,
        success: false,
        reason: "generate_link_failed",
        req,
      });
      return jsonResponse({ error: "Failed to issue session bootstrap", code: "session_bootstrap_failed" }, 500);
    }

    void logWalletAttempt({
      adminClient,
      attemptType: "login",
      address,
      userId,
      success: true,
      req,
    });

    return jsonResponse({
      ok: true,
      code: "ok",
      user_id: userId,
      isNewUser,
      needsEmailVerification: isNewUser,
      auth: {
        token_hash: linkData?.properties?.hashed_token ?? null,
      },
    });
  } catch (error) {
    console.error("[siwe-verify] unhandled error", error);
    return jsonResponse({ error: "Internal server error", code: "internal_error" }, 500);
  }
});
