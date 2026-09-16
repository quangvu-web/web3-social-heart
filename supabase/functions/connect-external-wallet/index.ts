import { corsHeaders, jsonResponse, normalizeAddress, parseChainId, requireUser } from "../_shared/walletAuth.ts";

type ConnectExternalWalletRequest = {
  address?: string;
  wallet_address?: string;
  chain_id?: number | null;
  chainId?: number | null;
  nonce?: string;
  message?: string;
  signature?: string;
};

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

  try {
    const body = (await req.json().catch(() => ({}))) as ConnectExternalWalletRequest;
    const address = normalizeAddress(body.address ?? body.wallet_address ?? "");
    const chainId = parseChainId(body.chainId ?? body.chain_id);
    const nonce = (body.nonce ?? "").trim();
    const message = (body.message ?? "").trim();
    const signature = (body.signature ?? "").trim();

    if (!address || !nonce || !message || !signature) {
      return jsonResponse(
        {
          success: false,
          error: "Missing signed wallet payload. Required: address, nonce, message, signature.",
        },
        400,
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const response = await fetch(`${supabaseUrl}/functions/v1/wallet-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: authHeader,
      },
      body: JSON.stringify({
        address,
        chainId,
        nonce,
        message,
        signature,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      return jsonResponse(
        {
          success: false,
          error: payload?.error || "Failed to connect external wallet",
        },
        response.status || 500,
      );
    }

    const wallet = payload.wallet as { address: string; chain_id: number | null };
    return jsonResponse({
      success: true,
      wallet_address: wallet.address,
      chain_id: wallet.chain_id,
      linked: true,
      wallet,
    });
  } catch (error) {
    console.error("[connect-external-wallet] unhandled", error);
    return jsonResponse({ success: false, error: "Internal server error" }, 500);
  }
});
