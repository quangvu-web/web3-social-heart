import {
  buildNonceMessage,
  corsHeaders,
  createNonce,
  enforceRateLimit,
  getClients,
  jsonResponse,
  logWalletAttempt,
  normalizeAddress,
  parseChainId,
  requireUser,
  sha256Hex,
  validateAddress,
  type WalletPurpose,
} from "../_shared/walletAuth.ts";

type WalletNonceRequest = {
  address: string;
  purpose: WalletPurpose;
  chainId?: number | null;
};

const NONCE_TTL_SECONDS = 5 * 60;
const NONCE_RATE_LIMIT = 12;
const NONCE_RATE_WINDOW_SECONDS = 5 * 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const { adminClient } = getClients(req);

  try {
    // Parse body and compute IP hash in parallel
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
    const [body, ipHash] = await Promise.all([
      req.json() as Promise<WalletNonceRequest>,
      sha256Hex(ip.split(",")[0]?.trim() ?? "0.0.0.0"),
    ]);

    const purpose = body?.purpose;
    const normalizedAddress = normalizeAddress(body?.address ?? "");
    const chainId = parseChainId(body?.chainId);

    if (purpose !== "link" && purpose !== "login") {
      return jsonResponse({ error: "Invalid purpose" }, 400);
    }

    if (!validateAddress(normalizedAddress)) {
      return jsonResponse({ error: "Invalid EVM address" }, 400);
    }

    let requestedByUserId: string | null = null;
    if (purpose === "link") {
      const auth = await requireUser(req);
      if ("error" in auth) {
        return auth.error;
      }
      requestedByUserId = auth.userId;
    }

    const rateKey = `nonce:${purpose}:${ipHash}:${normalizedAddress}`;
    const rateLimit = await enforceRateLimit({
      adminClient,
      key: rateKey,
      limit: NONCE_RATE_LIMIT,
      windowSeconds: NONCE_RATE_WINDOW_SECONDS,
    });

    if (!rateLimit.ok) {
      // Fire-and-forget
      logWalletAttempt({
        adminClient,
        attemptType: "nonce",
        address: normalizedAddress,
        userId: requestedByUserId,
        success: false,
        reason: "rate_limited",
        req,
      });
      return jsonResponse(
        { error: "Too many requests. Please try again later.", retryAfterSeconds: rateLimit.retryAfterSeconds },
        429,
      );
    }

    const nonce = createNonce();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + NONCE_TTL_SECONDS * 1000).toISOString();

    const { error: insertError } = await adminClient.from("wallet_nonces").insert({
      address: normalizedAddress,
      chain_id: chainId,
      nonce,
      purpose,
      requested_by_user_id: requestedByUserId,
      issued_at: issuedAt,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("[wallet-nonce] insert failed", insertError);
      // Fire-and-forget
      logWalletAttempt({
        adminClient,
        attemptType: "nonce",
        address: normalizedAddress,
        userId: requestedByUserId,
        success: false,
        reason: "insert_failed",
        req,
      });
      return jsonResponse({ error: "Failed to issue nonce" }, 500);
    }

    // Fire-and-forget
    logWalletAttempt({
      adminClient,
      attemptType: "nonce",
      address: normalizedAddress,
      userId: requestedByUserId,
      success: true,
      req,
    });

    const payload = buildNonceMessage({
      purpose,
      address: normalizedAddress,
      chainId,
      nonce,
      issuedAt,
      expiresAt,
      requestUrl: req.url,
    });

    return jsonResponse({
      nonce: payload.nonce,
      message: payload.message,
      messageToSign: payload.message,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      purpose,
    });
  } catch (error) {
    console.error("[wallet-nonce] unhandled error", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
