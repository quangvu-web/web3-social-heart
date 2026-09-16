import type { AuthTokenResponsePassword, OAuthResponse, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  AUTH_CHAIN_ID,
  isValidEvmAddress,
  linkWalletWithSharedFlow,
  normalizeAddress,
} from "@/features/auth/wallet/walletFlowShared";

export type OAuthProvider = "google" | "facebook";

export type UserWallet = {
  id: string;
  user_id: string;
  address: string;
  chain_id: number | null;
  is_primary: boolean;
  verified_at: string | null;
  created_at: string;
};

function parseChainId(chainIdHexOrNumber: unknown): number | null {
  if (typeof chainIdHexOrNumber === "number" && Number.isInteger(chainIdHexOrNumber)) {
    return chainIdHexOrNumber;
  }
  if (typeof chainIdHexOrNumber === "string") {
    if (chainIdHexOrNumber.startsWith("0x")) {
      return Number.parseInt(chainIdHexOrNumber, 16);
    }
    const parsed = Number.parseInt(chainIdHexOrNumber, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

async function getSessionOrThrow(): Promise<Session> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Bạn cần đăng nhập trước khi liên kết ví.");
  }
  return session;
}

function getInjectedProvider() {
  const ethereum = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
  if (!ethereum?.request) {
    throw new Error("Không tìm thấy ví EVM (window.ethereum).");
  }
  return ethereum;
}

export async function loginWithOtp(email: string) {
  return supabase.auth.signInWithOtp({ email });
}

export async function loginWithOAuth(provider: OAuthProvider): Promise<OAuthResponse> {
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
}

export async function loginWithPassword(email: string, password: string): Promise<AuthTokenResponsePassword> {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function linkWallet(): Promise<UserWallet> {
  await getSessionOrThrow();

  const ethereum = getInjectedProvider();
  const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
  const account = normalizeAddress(accounts?.[0] ?? "");

  if (!isValidEvmAddress(account)) {
    throw new Error("Địa chỉ ví không hợp lệ.");
  }

  const chainRaw = await ethereum.request({ method: "eth_chainId" });
  const chainId = parseChainId(chainRaw);
  if (chainId !== AUTH_CHAIN_ID) {
    throw new Error("Vui lòng chuyển sang đúng mạng để tiếp tục.");
  }

  return linkWalletWithSharedFlow({
    address: account,
    chainId,
    connectorType: "injected",
    signMessageAsync: async ({ message }) => {
      try {
        return (await ethereum.request({
          method: "personal_sign",
          params: [message, account],
        })) as string;
      } catch {
        return (await ethereum.request({
          method: "personal_sign",
          params: [account, message],
        })) as string;
      }
    },
  });
}

export async function unlinkWallet(input: { chainId?: number | null; address?: string; walletId?: string }) {
  await getSessionOrThrow();

  let query = supabase.from("user_wallets").delete();

  if (input.walletId) {
    query = query.eq("id", input.walletId);
  }

  if (input.address) {
    const address = normalizeAddress(input.address);
    if (!isValidEvmAddress(address)) {
      throw new Error("Địa chỉ ví không hợp lệ.");
    }
    query = query.eq("address", address);
  }

  if (typeof input.chainId === "number") {
    query = query.eq("chain_id", input.chainId);
  }

  const { error } = await query;
  if (error) {
    throw new Error(error.message || "Không thể hủy liên kết ví.");
  }
}
