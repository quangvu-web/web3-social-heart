import {
  buildNonceMessage,
  corsHeaders,
  createNonce,
  getClients,
  jsonResponse,
  logWalletAttempt,
  normalizeAddress,
  parseChainId,
  sha256Hex,
  validateAddress,
} from "../_shared/walletAuth.ts";

type SiweNonceRequest = {
  address: string;
  chainId?: number | null;
};

const NONCE_TTL_SECONDS = 5 * 60;
const NONCE_RATE_LIMIT = 20;
const NONCE_RATE_WINDOW_MS = 5 * 60 * 1000;
const AUTH_CHAIN_ID = 56;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", code: "method_not_allowed" }, 405);
  }

  try {
    const { adminClient } = getClients(req);
    const body = (await req.json()) as SiweNonceRequest;
    const address = normalizeAddress(body?.address ?? "");
    const requestedChainId = parseChainId(body?.chainId) ?? AUTH_CHAIN_ID;

    if (!validateAddress(address)) {
      void logWalletAttempt({
        adminClient,
        attemptType: "nonce",
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

    const ipRaw = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
    const ipHash = await sha256Hex(ipRaw.split(",")[0]?.trim() ?? "0.0.0.0");
    const rateKey = `siwe_nonce:${ipHash}:${address}`;

    const { data: rateLimitData, error: rateLimitError } = await adminClient.rpc("check_rate_limit", {
      p_key: rateKey,
      p_limit: NONCE_RATE_LIMIT,
      p_window_ms: NONCE_RATE_WINDOW_MS,
    });

    if (rateLimitError) {
      console.error("[siwe-nonce] rate limit check failed", rateLimitError);
    }

    if (rateLimitData && !rateLimitData.allowed) {
      void logWalletAttempt({
        adminClient,
        attemptType: "nonce",
        address,
        success: false,
        reason: "rate_limited",
        req,
      });
      return jsonResponse({ error: "Too many requests. Please try again later.", code: "rate_limited" }, 429);
    }

    const nonce = createNonce();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + NONCE_TTL_SECONDS * 1000).toISOString();

    const { error: insertError } = await adminClient.from("siwe_nonces").insert({
      address,
      nonce,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("[siwe-nonce] insert nonce failed", insertError);
      void logWalletAttempt({
        adminClient,
        attemptType: "nonce",
        address,
        success: false,
        reason: "insert_failed",
        req,
      });
      return jsonResponse({ error: "Failed to issue SIWE nonce", code: "insert_failed" }, 500);
    }

    const payload = buildNonceMessage({
      purpose: "login",
      address,
      chainId: AUTH_CHAIN_ID,
      nonce,
      issuedAt,
      expiresAt,
      requestUrl: req.url,
    });

    void logWalletAttempt({
      adminClient,
      attemptType: "nonce",
      address,
      success: true,
      req,
    });

    return jsonResponse({
      nonce: payload.nonce,
      expiresAt: payload.expiresAt,
      message: payload.message,
      code: "ok",
      expectedChainId: AUTH_CHAIN_ID,
    });
  } catch (error) {
    console.error("[siwe-nonce] unhandled error", error);
    return jsonResponse({ error: "Internal server error", code: "internal_error" }, 500);
  }
});
