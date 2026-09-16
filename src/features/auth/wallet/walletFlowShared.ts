import { bsc } from "wagmi/chains";
import { supabase } from "@/integrations/supabase/client";

export const AUTH_CHAIN_ID = bsc.id;
export const WALLET_AUTH_SNAPSHOT_KEY = "fun_wallet_auth_flow";
export const WALLET_AUTH_DEBUG_KEY = "FUN_PROFILE_DEBUG";

export type WalletAuthPurpose = "login" | "link";
export type WalletAuthMode = "injected_mobile_browser" | "wallet_modal_or_walletconnect";

export type NoncePayload = {
  nonce: string;
  message: string;
  expiresAt?: string;
};

export type WalletAuthErrorCode =
  | "pending_request"
  | "user_rejected"
  | "nonce_invalid"
  | "nonce_expired"
  | "wrong_chain"
  | "verification_failed"
  | "wallet_not_linked"
  | "account_changed"
  | "chain_changed"
  | "disconnected"
  | "unknown";

export type WalletAuthError = {
  code: WalletAuthErrorCode;
  message: string;
};

export type WalletFlowPhase =
  | "idle"
  | "connecting"
  | "connected"
  | "wrong_chain"
  | "ready_to_sign"
  | "signing"
  | "signing_pending_wallet"
  | "verifying"
  | "authenticated"
  | "error";

export type WalletAuthSnapshot = {
  purpose: WalletAuthPurpose;
  phase: Exclude<WalletFlowPhase, "authenticated" | "error">;
  authMode: WalletAuthMode;
  account: string;
  chainId: number | null;
  connectorType: string;
  nonce?: string;
  message?: string;
  expiresAt?: string;
  signRequestStarted: boolean;
  pendingRequestDetected: boolean;
  updatedAt: string;
};

export type LinkWalletResult = {
  id: string;
  user_id: string;
  address: string;
  chain_id: number | null;
  is_primary: boolean;
  verified_at: string | null;
  created_at: string;
};

const EVM_REGEX = /^0x[0-9a-f]{40}$/;

let linkSignLock = false;

export function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEvmAddress(value: string | null | undefined): value is `0x${string}` {
  return Boolean(value && EVM_REGEX.test(normalizeAddress(value)));
}

export function shouldDebugWalletAuth(): boolean {
  if (typeof window === "undefined") return false;
  const envEnabled = String(import.meta.env.VITE_ENABLE_WALLET_AUTH_DEBUG || "").toLowerCase() === "true";
  const localEnabled = window.localStorage?.getItem(WALLET_AUTH_DEBUG_KEY) === "true";
  return envEnabled || localEnabled;
}

export function logWalletAuth(event: string, payload: Record<string, unknown>) {
  if (!shouldDebugWalletAuth()) return;
  console.debug(`[wallet-auth] ${event}`, payload);
}

export function getConnectorType(input?: { connectorName?: string | null; provider?: unknown }): string {
  const provider = input?.provider as Record<string, unknown> | undefined;
  const connectorName = input?.connectorName?.toLowerCase() ?? "";

  if (connectorName.includes("walletconnect")) return "walletconnect";
  if (connectorName.includes("trust")) return "trustwallet";
  if (connectorName.includes("meta")) return "metamask";
  if (connectorName.includes("coinbase")) return "coinbase";
  if (provider?.isMetaMask) return "metamask";
  if (provider?.isTrust || provider?.isTrustWallet) return "trustwallet";
  return connectorName || "unknown";
}

export function loadWalletAuthSnapshot(): WalletAuthSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WALLET_AUTH_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WalletAuthSnapshot;
  } catch {
    return null;
  }
}

export function saveWalletAuthSnapshot(snapshot: WalletAuthSnapshot | null) {
  if (typeof window === "undefined") return;
  try {
    if (!snapshot) {
      window.localStorage.removeItem(WALLET_AUTH_SNAPSHOT_KEY);
      return;
    }
    window.localStorage.setItem(WALLET_AUTH_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore storage failures in private mode
  }
}

export function clearWalletAuthSnapshot() {
  saveWalletAuthSnapshot(null);
}

function extractWalletErrorCode(error: unknown): number | string | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as {
    code?: unknown;
    cause?: { code?: unknown };
    data?: { code?: unknown; originalError?: { code?: unknown } };
  };

  const raw =
    candidate.code ??
    candidate.cause?.code ??
    candidate.data?.code ??
    candidate.data?.originalError?.code ??
    null;

  if (typeof raw === 'number' || typeof raw === 'string') return raw;
  return null;
}

function extractWalletErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (!error || typeof error !== "object") {
    return String(error ?? "");
  }

  const candidate = error as {
    message?: unknown;
    shortMessage?: unknown;
    details?: unknown;
    reason?: unknown;
    cause?: { message?: unknown; shortMessage?: unknown };
    data?: { message?: unknown; originalError?: { message?: unknown } };
  };

  const parts = [
    candidate.message,
    candidate.shortMessage,
    candidate.details,
    candidate.reason,
    candidate.cause?.message,
    candidate.cause?.shortMessage,
    candidate.data?.message,
    candidate.data?.originalError?.message,
  ];

  const first = parts.find((part) => typeof part === "string" && part.trim());
  return typeof first === "string" ? first : String(error);
}

export function classifyWalletError(error: unknown): WalletAuthError {
  const rawMessage = extractWalletErrorMessage(error);
  const message = rawMessage.trim() || "Đã có lỗi xảy ra trong quá trình xác thực ví.";
  const lower = message.toLowerCase();
  const code = extractWalletErrorCode(error);

  if (
    code === -32002 ||
    lower.includes("already pending") ||
    lower.includes("request of type 'personal_sign' already pending")
  ) {
    return {
      code: "pending_request",
      message: "Yêu cầu ký đang chờ xử lý trong MetaMask. Vui lòng mở lại cửa sổ xác nhận trong ví để tiếp tục.",
    };
  }

  if (code === 4001 || lower.includes("user rejected") || lower.includes("rejected the request") || lower.includes("hủy")) {
    return {
      code: "user_rejected",
      message: "Bạn đã hủy xác nhận chữ ký.",
    };
  }

  if (lower.includes("nonce") && lower.includes("expired")) {
    return {
      code: "nonce_expired",
      message: "Nonce đã hết hạn. Vui lòng thử lại để nhận yêu cầu ký mới.",
    };
  }

  if (lower.includes("nonce")) {
    return {
      code: "nonce_invalid",
      message: "Nonce không hợp lệ hoặc đã được sử dụng. Vui lòng thử lại.",
    };
  }

  if (lower.includes("wrong_chain") || lower.includes("đúng mạng") || lower.includes("wrong network")) {
    return {
      code: "wrong_chain",
      message: "Vui lòng chuyển sang đúng mạng để tiếp tục.",
    };
  }

  if (lower.includes("wallet_not_linked")) {
    return {
      code: "wallet_not_linked",
      message: "Ví này chưa được liên kết với tài khoản nào.",
    };
  }

  if (lower.includes("signature") || lower.includes("verify") || lower.includes("verification")) {
    return {
      code: "verification_failed",
      message,
    };
  }

  return {
    code: "unknown",
    message,
  };
}

async function readFunctionsError(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;
  const resp: Response | undefined =
    ctx instanceof Response
      ? ctx
      : (ctx as { response?: Response } | undefined)?.response;
  if (resp) {
    try {
      const body = await resp.clone().json();
      if (body && typeof body.error === "string" && body.error.trim()) {
        return body.error;
      }
    } catch {
      // not JSON
    }
  }
  const msg = (error as { message?: string })?.message;
  return msg && msg.trim() ? msg : fallback;
}

export async function requestBackendNonce(input: {
  purpose: WalletAuthPurpose;
  address: string;
  chainId?: number | null;
}): Promise<NoncePayload> {
  const address = normalizeAddress(input.address);
  const functionName = input.purpose === "login" ? "siwe-nonce" : "wallet-nonce";
  const body =
    input.purpose === "login"
      ? { address, chainId: AUTH_CHAIN_ID }
      : { address, purpose: "link", chainId: input.chainId ?? AUTH_CHAIN_ID };

  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) {
    const fromData = (data as { error?: string } | null)?.error;
    throw new Error(fromData || (await readFunctionsError(error, "Không thể tạo nonce.")));
  }

  const payload = data as NoncePayload & { error?: string };
  if (!payload?.nonce || !payload?.message) {
    throw new Error(payload?.error || "Phản hồi nonce không hợp lệ.");
  }

  return payload;
}

export async function verifyWalletLoginSignature(input: {
  address: string;
  nonce: string;
  message: string;
  signature: string;
}) {
  const { data, error } = await supabase.functions.invoke("siwe-verify", {
    body: {
      address: normalizeAddress(input.address),
      chainId: AUTH_CHAIN_ID,
      nonce: input.nonce,
      message: input.message,
      signature: input.signature,
    },
  });

  if (error) {
    const fromData = (data as { error?: string } | null)?.error;
    throw new Error(fromData || (await readFunctionsError(error, "Không thể xác thực ví.")));
  }

  const payload = data as {
    ok?: boolean;
    error?: string;
    code?: string;
    user_id?: string;
    isNewUser?: boolean;
    needsEmailVerification?: boolean;
    auth?: { token_hash?: string | null };
    requires_telegram_2fa?: boolean;
    challenge_id?: string;
    expires_in_seconds?: number;
  };

  if (!payload?.ok || !payload.user_id) {
    throw new Error(payload?.error || "Không thể hoàn tất xác thực ví.");
  }

  if (payload.requires_telegram_2fa) {
    if (!payload.challenge_id) {
      throw new Error(payload.error || "Telegram 2FA challenge missing.");
    }
    return payload;
  }

  if (!payload.auth?.token_hash) {
    throw new Error(payload?.error || "Không thể hoàn tất xác thực ví.");
  }

  return payload;
}

export async function verifyWalletLinkSignature(input: {
  address: string;
  chainId: number | null;
  nonce: string;
  message: string;
  signature: string;
}): Promise<LinkWalletResult> {
  const { data, error } = await supabase.functions.invoke("wallet-link", {
    body: {
      address: normalizeAddress(input.address),
      chainId: input.chainId ?? AUTH_CHAIN_ID,
      nonce: input.nonce,
      message: input.message,
      signature: input.signature,
    },
  });

  if (error) {
    const fromData = (data as { error?: string } | null)?.error;
    throw new Error(fromData || (await readFunctionsError(error, "Không thể liên kết ví.")));
  }

  const payload = data as { ok?: boolean; wallet?: LinkWalletResult; error?: string };
  if (!payload?.ok || !payload.wallet) {
    throw new Error(payload?.error || "Liên kết ví thất bại.");
  }

  return payload.wallet;
}

export async function completeSupabaseWalletSession(tokenHash: string) {
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  if (error) {
    throw new Error(error.message || "Không thể tạo phiên đăng nhập.");
  }
}

export async function linkWalletWithSharedFlow(input: {
  address: string;
  chainId: number | null;
  signMessageAsync: (args: { account: `0x${string}`; message: string }) => Promise<string>;
  connectorType?: string;
}) {
  if (linkSignLock) {
    throw new Error("Yêu cầu ký đang chờ xử lý trong ví. Vui lòng mở lại MetaMask/Trust Wallet để xác nhận.");
  }

  linkSignLock = true;
  try {
    const noncePayload = await requestBackendNonce({
      purpose: "link",
      address: input.address,
      chainId: input.chainId ?? AUTH_CHAIN_ID,
    });

    logWalletAuth("link_nonce_requested", {
      connectorType: input.connectorType ?? "unknown",
      account: normalizeAddress(input.address),
      chainId: input.chainId ?? AUTH_CHAIN_ID,
      nonceRequested: true,
    });

    const signature = await input.signMessageAsync({
      account: normalizeAddress(input.address) as `0x${string}`,
      message: noncePayload.message,
    });

    logWalletAuth("link_sign_completed", {
      connectorType: input.connectorType ?? "unknown",
      account: normalizeAddress(input.address),
      chainId: input.chainId ?? AUTH_CHAIN_ID,
    });

    return await verifyWalletLinkSignature({
      address: input.address,
      chainId: input.chainId ?? AUTH_CHAIN_ID,
      nonce: noncePayload.nonce,
      message: noncePayload.message,
      signature,
    });
  } finally {
    linkSignLock = false;
  }
}
