import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId, useDisconnect, useSignMessage, useSwitchChain } from "wagmi";
import { bsc } from "wagmi/chains";
import { supabase } from "@/integrations/supabase/client";
import {
  AUTH_CHAIN_ID,
  type LinkWalletResult,
  type NoncePayload,
  type WalletAuthError,
  type WalletAuthMode,
  type WalletFlowPhase,
  classifyWalletError,
  clearWalletAuthSnapshot,
  completeSupabaseWalletSession,
  getConnectorType,
  isValidEvmAddress,
  linkWalletWithSharedFlow,
  loadWalletAuthSnapshot,
  logWalletAuth,
  normalizeAddress,
  requestBackendNonce,
  saveWalletAuthSnapshot,
  verifyWalletLoginSignature,
} from "./walletFlowShared";
import {
  ensureBscNetwork,
  getInjectedAccounts,
  getInjectedMobileBrowserType,
  getInjectedProvider,
  isInjectedMobileBrowser,
  normalizeChainId,
  requestInjectedAccounts,
  type Eip1193Provider,
} from "@/utils/mobileWalletConnect";
import { clearWalletLocalStorage, fullWalletDisconnect, requestWalletSwitch } from "@/utils/walletSessionReset";

export type UserWallet = {
  id: string;
  user_id: string;
  address: string;
  chain_id: number | null;
  is_primary: boolean;
  verified_at: string | null;
  created_at: string;
};

export type WalletLoginResult = {
  user_id: string;
  isNewUser: boolean;
  needsEmailVerification: boolean;
  telegramChallenge?: {
    challengeId: string;
    expiresInSeconds: number;
  };
};

type ResetReason =
  | "manual"
  | "retry"
  | "disconnect"
  | "switch_wallet"
  | "account_changed"
  | "chain_changed";

type LoginErrorState = WalletAuthError & {
  recoverable: boolean;
};

function isSupportedAuthChain(chainId: number | null | undefined) {
  return chainId === AUTH_CHAIN_ID;
}

function makeAttemptId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function requestPersonalSign(params: {
  provider: Eip1193Provider;
  account: string;
  message: string;
}) {
  try {
    return (await params.provider.request({
      method: "personal_sign",
      params: [params.message, params.account],
    })) as string;
  } catch {
    return (await params.provider.request({
      method: "personal_sign",
      params: [params.account, params.message],
    })) as string;
  }
}

export function useWalletAuth() {
  const account = useAccount();
  const chainId = useChainId();
  const { signMessageAsync, isPending: wagmiSigning } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();

  const authMode: WalletAuthMode = useMemo(
    () => (isInjectedMobileBrowser() ? "injected_mobile_browser" : "wallet_modal_or_walletconnect"),
    [],
  );
  const injectedProvider = useMemo(() => getInjectedProvider(), []);

  const wagmiAddress = useMemo(() => (account.address ? normalizeAddress(account.address) : null), [account.address]);
  const [injectedAddress, setInjectedAddress] = useState<string | null>(null);
  const [injectedChainId, setInjectedChainId] = useState<number | null>(null);

  const connectorType = useMemo(() => {
    if (authMode === "injected_mobile_browser") {
      return getInjectedMobileBrowserType();
    }
    return getConnectorType({ connectorName: account.connector?.name ?? null });
  }, [account.connector?.name, authMode]);

  const connectedAddress = authMode === "injected_mobile_browser" ? injectedAddress ?? wagmiAddress : wagmiAddress;
  const effectiveChainId = authMode === "injected_mobile_browser" ? injectedChainId ?? normalizeChainId(chainId) : normalizeChainId(chainId);
  const isConnected = authMode === "injected_mobile_browser" ? Boolean(connectedAddress) : account.isConnected;

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [linkedWallets, setLinkedWallets] = useState<UserWallet[]>([]);
  const [isLoadingWallets, setIsLoadingWallets] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [basePhase, setBasePhase] = useState<WalletFlowPhase>("idle");
  const [error, setError] = useState<LoginErrorState | null>(null);
  const [isSwitchingWallet, setIsSwitchingWallet] = useState(false);
  const [pendingRequestDetected, setPendingRequestDetected] = useState(false);
  const [wasBackgroundedDuringSign, setWasBackgroundedDuringSign] = useState(false);
  const [nonceExpiresAt, setNonceExpiresAt] = useState<string | null>(null);

  const signLockRef = useRef(false);
  const verifyLockRef = useRef(false);
  const activeAttemptIdRef = useRef<string | null>(null);
  const nonceRef = useRef<NoncePayload | null>(null);
  const signatureRef = useRef<string | null>(null);
  const trackedAddressRef = useRef<string | null>(null);
  const trackedChainIdRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const userId = session?.user?.id ?? null;
    setSessionUserId(userId);

    if (!userId) {
      setLinkedWallets([]);
      setIsLoadingWallets(false);
      return;
    }

    setIsLoadingWallets(true);
    const { data, error: queryError } = await supabase
      .from("user_wallets")
      .select("id, user_id, address, chain_id, is_primary, verified_at, created_at")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false })
      .order("verified_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (queryError) {
      setLinkedWallets([]);
    } else {
      setLinkedWallets((data ?? []) as UserWallet[]);
    }

    setIsLoadingWallets(false);
  }, []);

  const clearTransientState = useCallback((reason: ResetReason) => {
    signLockRef.current = false;
    verifyLockRef.current = false;
    activeAttemptIdRef.current = null;
    nonceRef.current = null;
    signatureRef.current = null;
    setPendingRequestDetected(false);
    setWasBackgroundedDuringSign(false);
    setNonceExpiresAt(null);
    clearWalletAuthSnapshot();
    logWalletAuth("flow_reset", { reason, authMode });
  }, [authMode]);

  const syncInjectedState = useCallback(async (requestAccess = false) => {
    if (authMode !== "injected_mobile_browser" || !injectedProvider) return null;

    const accounts = requestAccess
      ? await requestInjectedAccounts(injectedProvider)
      : await getInjectedAccounts(injectedProvider);
    const nextAddress = normalizeAddress(accounts?.[0] ?? "");
    const rawChainId = await injectedProvider.request({ method: "eth_chainId" });
    const nextChainId = normalizeChainId(rawChainId);

    setInjectedAddress(isValidEvmAddress(nextAddress) ? nextAddress : null);
    setInjectedChainId(nextChainId);

    return {
      address: isValidEvmAddress(nextAddress) ? nextAddress : null,
      chainId: nextChainId,
    };
  }, [authMode, injectedProvider]);

  const resetWalletAuthFlow = useCallback(
    (reason: ResetReason = "manual") => {
      clearTransientState(reason);
      setError(null);
      if (reason === "disconnect") {
        setBasePhase("idle");
        return;
      }
      if (connectedAddress && isSupportedAuthChain(effectiveChainId)) {
        setBasePhase("connected");
      } else if (connectedAddress) {
        setBasePhase("wrong_chain");
      } else {
        setBasePhase("idle");
      }
    },
    [clearTransientState, connectedAddress, effectiveChainId],
  );

  const effectivePhase = useMemo<WalletFlowPhase>(() => {
    if (basePhase === "authenticated") return "authenticated";
    if (!isConnected || !connectedAddress) return basePhase === "connecting" ? "connecting" : "idle";
    if (!isSupportedAuthChain(effectiveChainId)) return "wrong_chain";
    if (basePhase === "signing" || basePhase === "signing_pending_wallet" || basePhase === "verifying" || basePhase === "error") {
      return basePhase;
    }
    if (nonceRef.current?.nonce && nonceRef.current?.message) return "ready_to_sign";
    return "connected";
  }, [basePhase, connectedAddress, effectiveChainId, isConnected]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [refresh]);

  useEffect(() => {
    if (authMode !== "injected_mobile_browser") return;
    void syncInjectedState(false);
  }, [authMode, syncInjectedState]);

  useEffect(() => {
    const snapshot = loadWalletAuthSnapshot();
    if (!snapshot || !connectedAddress) return;
    if (snapshot.account !== connectedAddress) return;
    if (snapshot.authMode !== authMode) return;
    if (snapshot.purpose !== "login") return;
    if (snapshot.chainId !== null && effectiveChainId !== null && snapshot.chainId !== effectiveChainId) {
      clearWalletAuthSnapshot();
      return;
    }

    nonceRef.current = snapshot.nonce && snapshot.message
      ? {
          nonce: snapshot.nonce,
          message: snapshot.message,
          expiresAt: snapshot.expiresAt,
        }
      : null;
    setNonceExpiresAt(snapshot.expiresAt ?? null);
    setPendingRequestDetected(snapshot.pendingRequestDetected);
    setBasePhase(snapshot.phase);
  }, [authMode, connectedAddress, effectiveChainId]);

  useEffect(() => {
    trackedAddressRef.current = connectedAddress;
    trackedChainIdRef.current = effectiveChainId ?? null;
  }, [connectedAddress, effectiveChainId]);

  useEffect(() => {
    if (!isConnected || !connectedAddress) {
      clearTransientState("disconnect");
      setError(null);
      setBasePhase("idle");
      return;
    }

    if (isSupportedAuthChain(effectiveChainId)) {
      if (basePhase === "idle" || basePhase === "connecting" || basePhase === "wrong_chain") {
        setBasePhase("connected");
      }
    } else if (basePhase !== "authenticated") {
      clearTransientState("chain_changed");
      setBasePhase("wrong_chain");
    }
  }, [basePhase, clearTransientState, connectedAddress, effectiveChainId, isConnected]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && (signLockRef.current || pendingRequestDetected)) {
        setWasBackgroundedDuringSign(true);
        logWalletAuth("app_visible_during_sign", {
          connectorType,
          account: connectedAddress,
          chainId: effectiveChainId ?? null,
          authMode,
        });
      }
    };

    const handleFocus = () => {
      if (signLockRef.current || pendingRequestDetected) {
        setWasBackgroundedDuringSign(true);
        logWalletAuth("window_focus_during_sign", {
          connectorType,
          account: connectedAddress,
          chainId: effectiveChainId ?? null,
          authMode,
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [authMode, connectedAddress, connectorType, effectiveChainId, pendingRequestDetected]);

  useEffect(() => {
    const provider = authMode === "injected_mobile_browser" ? injectedProvider : getInjectedProvider();
    if (!provider?.on) return;

    const handleAccountsChanged = (accounts: string[]) => {
      const next = normalizeAddress(accounts?.[0] ?? "");
      const normalizedNext = isValidEvmAddress(next) ? next : null;
      if (authMode === "injected_mobile_browser") {
        setInjectedAddress(normalizedNext);
      }

      logWalletAuth("accounts_changed", {
        connectorType,
        previousAccount: trackedAddressRef.current,
        nextAccount: normalizedNext,
        authMode,
      });

      if (!accounts.length) {
        resetWalletAuthFlow("disconnect");
        return;
      }

      if (trackedAddressRef.current && normalizedNext !== trackedAddressRef.current) {
        clearTransientState("account_changed");
        setError(null);
        setBasePhase(isSupportedAuthChain(effectiveChainId) ? "connected" : "wrong_chain");
      }
    };

    const handleChainChanged = (rawChainId: string | number) => {
      const nextChainId = normalizeChainId(rawChainId);
      if (authMode === "injected_mobile_browser") {
        setInjectedChainId(nextChainId);
      }

      logWalletAuth("chain_changed", {
        connectorType,
        account: trackedAddressRef.current,
        previousChainId: trackedChainIdRef.current,
        nextChainId,
        authMode,
      });

      clearTransientState("chain_changed");
      setError(null);
      setBasePhase(nextChainId === AUTH_CHAIN_ID ? "connected" : "wrong_chain");
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [authMode, clearTransientState, connectorType, effectiveChainId, injectedProvider, resetWalletAuthFlow]);

  const connectInjectedWallet = useCallback(async () => {
    if (!injectedProvider) {
      throw new Error("Không tìm thấy MetaMask hoặc ví in-app hỗ trợ.");
    }
    setBasePhase("connecting");
    setError(null);

    const state = await syncInjectedState(true);
    if (!state?.address) {
      throw new Error("Không thể lấy tài khoản ví từ MetaMask.");
    }

    logWalletAuth("injected_connected", {
      connectorType,
      account: state.address,
      chainId: state.chainId,
      authMode,
    });

    setBasePhase(isSupportedAuthChain(state.chainId) ? "connected" : "wrong_chain");
    return state;
  }, [authMode, connectorType, injectedProvider, syncInjectedState]);

  const connectWallet = useCallback(async () => {
    if (authMode === "injected_mobile_browser") {
      return connectInjectedWallet();
    }
    setBasePhase("connecting");
    return null;
  }, [authMode, connectInjectedWallet]);

  const ensureSupportedChain = useCallback(async () => {
    if (isSupportedAuthChain(effectiveChainId)) return true;

    setBasePhase("wrong_chain");
    setError({
      code: "wrong_chain",
      message: "Vui lòng chuyển sang đúng mạng để tiếp tục.",
      recoverable: true,
    });

    try {
      if (authMode === "injected_mobile_browser") {
        if (!injectedProvider) throw new Error("Wallet provider not available");
        const result = await ensureBscNetwork({ provider: injectedProvider, preferredChainId: bsc.id });
        setInjectedChainId(result.chainId);
        if (!result.ok || result.chainId !== AUTH_CHAIN_ID) {
          throw new Error("Vui lòng chuyển sang đúng mạng để tiếp tục.");
        }
      } else {
        await switchChainAsync({ chainId: bsc.id });
      }

      setError(null);
      setBasePhase("connected");
      return true;
    } catch (switchError) {
      const parsed = classifyWalletError(switchError);
      setError({ ...parsed, recoverable: true });
      return false;
    }
  }, [authMode, effectiveChainId, injectedProvider, switchChainAsync]);

  const requestNonce = useCallback(async () => {
    if (!connectedAddress || !isConnected) {
      throw new Error("Vui lòng kết nối ví trước.");
    }
    if (!isSupportedAuthChain(effectiveChainId)) {
      throw new Error("Vui lòng chuyển sang đúng mạng để tiếp tục.");
    }

    const payload = await requestBackendNonce({
      purpose: "login",
      address: connectedAddress,
      chainId: AUTH_CHAIN_ID,
    });

    nonceRef.current = payload;
    setNonceExpiresAt(payload.expiresAt ?? null);
    setBasePhase("ready_to_sign");
    saveWalletAuthSnapshot({
      purpose: "login",
      phase: "ready_to_sign",
      authMode,
      account: connectedAddress,
      chainId: AUTH_CHAIN_ID,
      connectorType,
      nonce: payload.nonce,
      message: payload.message,
      expiresAt: payload.expiresAt,
      signRequestStarted: false,
      pendingRequestDetected: false,
      updatedAt: new Date().toISOString(),
    });

    logWalletAuth("nonce_requested", {
      connectorType,
      account: connectedAddress,
      chainId: AUTH_CHAIN_ID,
      authMode,
    });

    return payload;
  }, [authMode, connectedAddress, connectorType, effectiveChainId, isConnected]);

  const signNonceMessage = useCallback(
    async (attemptId: string, noncePayload: NoncePayload) => {
      if (!connectedAddress || !isConnected) {
        throw new Error("Ví đã bị ngắt kết nối.");
      }

      if (signLockRef.current) {
        throw new Error("Yêu cầu ký đang chờ xử lý trong MetaMask. Vui lòng mở lại cửa sổ xác nhận trong ví để tiếp tục.");
      }

      signLockRef.current = true;
      activeAttemptIdRef.current = attemptId;
      setPendingRequestDetected(false);
      setWasBackgroundedDuringSign(false);
      setError(null);
      setBasePhase("signing");

      saveWalletAuthSnapshot({
        purpose: "login",
        phase: "signing",
        authMode,
        account: connectedAddress,
        chainId: AUTH_CHAIN_ID,
        connectorType,
        nonce: noncePayload.nonce,
        message: noncePayload.message,
        expiresAt: noncePayload.expiresAt,
        signRequestStarted: true,
        pendingRequestDetected: false,
        updatedAt: new Date().toISOString(),
      });

      logWalletAuth("sign_started", {
        connectorType,
        account: connectedAddress,
        chainId: AUTH_CHAIN_ID,
        authMode,
      });

      try {
        const signature =
          authMode === "injected_mobile_browser" && injectedProvider
            ? await requestPersonalSign({
                provider: injectedProvider,
                account: connectedAddress,
                message: noncePayload.message,
              })
            : await signMessageAsync({
                account: connectedAddress as `0x${string}`,
                message: noncePayload.message,
              });

        if (activeAttemptIdRef.current !== attemptId) {
          throw new Error("Tài khoản ví đã thay đổi. Vui lòng thử lại.");
        }

        signatureRef.current = signature;
        signLockRef.current = false;
        logWalletAuth("sign_completed", {
          connectorType,
          account: connectedAddress,
          chainId: AUTH_CHAIN_ID,
          authMode,
        });
        return signature;
      } catch (signError) {
        signLockRef.current = false;
        const parsed = classifyWalletError(signError);
        if (parsed.code === "pending_request") {
          setPendingRequestDetected(true);
          setBasePhase("signing_pending_wallet");
          saveWalletAuthSnapshot({
            purpose: "login",
            phase: "signing_pending_wallet",
            authMode,
            account: connectedAddress,
            chainId: AUTH_CHAIN_ID,
            connectorType,
            nonce: noncePayload.nonce,
            message: noncePayload.message,
            expiresAt: noncePayload.expiresAt,
            signRequestStarted: true,
            pendingRequestDetected: true,
            updatedAt: new Date().toISOString(),
          });
        } else {
          setError({ ...parsed, recoverable: true });
          setBasePhase("error");
          clearWalletAuthSnapshot();
        }
        throw signError;
      }
    },
    [authMode, connectedAddress, connectorType, injectedProvider, isConnected, signMessageAsync],
  );

  const verifyWalletSignature = useCallback(
    async (attemptId: string, noncePayload: NoncePayload, signature: string): Promise<WalletLoginResult> => {
      if (verifyLockRef.current) {
        throw new Error("Đang xác thực ví. Vui lòng chờ.");
      }
      verifyLockRef.current = true;
      setBasePhase("verifying");
      setError(null);
      saveWalletAuthSnapshot({
        purpose: "login",
        phase: "verifying",
        authMode,
        account: connectedAddress ?? "",
        chainId: AUTH_CHAIN_ID,
        connectorType,
        nonce: noncePayload.nonce,
        message: noncePayload.message,
        expiresAt: noncePayload.expiresAt,
        signRequestStarted: true,
        pendingRequestDetected: false,
        updatedAt: new Date().toISOString(),
      });

      try {
        const payload = await verifyWalletLoginSignature({
          address: connectedAddress ?? "",
          nonce: noncePayload.nonce,
          message: noncePayload.message,
          signature,
        });

        if (activeAttemptIdRef.current !== attemptId) {
          throw new Error("Tài khoản ví đã thay đổi. Vui lòng thử lại.");
        }

        if (payload.requires_telegram_2fa && payload.challenge_id) {
          // Do not establish a session yet — caller must complete Telegram OTP first.
          clearTransientState("manual");
          setBasePhase("idle");
          logWalletAuth("verify_completed", {
            connectorType,
            account: connectedAddress,
            chainId: AUTH_CHAIN_ID,
            authMode,
          });
          return {
            user_id: payload.user_id!,
            isNewUser: Boolean(payload.isNewUser),
            needsEmailVerification: Boolean(payload.needsEmailVerification),
            telegramChallenge: {
              challengeId: payload.challenge_id,
              expiresInSeconds: payload.expires_in_seconds ?? 300,
            },
          };
        }

        await completeSupabaseWalletSession(payload.auth!.token_hash!);
        await refresh();
        clearTransientState("manual");
        setBasePhase("authenticated");

        logWalletAuth("verify_completed", {
          connectorType,
          account: connectedAddress,
          chainId: AUTH_CHAIN_ID,
          authMode,
        });

        return {
          user_id: payload.user_id!,
          isNewUser: Boolean(payload.isNewUser),
          needsEmailVerification: Boolean(payload.needsEmailVerification),
        };
      } finally {
        verifyLockRef.current = false;
      }
    },
    [authMode, clearTransientState, connectedAddress, connectorType, refresh],
  );

  const startWalletLoginFlow = useCallback(async (): Promise<WalletLoginResult> => {
    if (authMode === "injected_mobile_browser" && !connectedAddress) {
      throw new Error("Bạn đang ở trong MetaMask. Hãy kết nối ví để tiếp tục.");
    }
    if (!connectedAddress || !isConnected) {
      throw new Error("Vui lòng kết nối ví trước.");
    }

    if (signLockRef.current || effectivePhase === "signing_pending_wallet") {
      const pendingError = {
        code: "pending_request" as const,
        message: "Yêu cầu ký đang chờ xử lý trong MetaMask. Vui lòng mở lại cửa sổ xác nhận trong ví để tiếp tục.",
        recoverable: true,
      };
      setPendingRequestDetected(true);
      setError(pendingError);
      setBasePhase("signing_pending_wallet");
      throw new Error(pendingError.message);
    }

    const chainOk = await ensureSupportedChain();
    if (!chainOk) {
      throw new Error("Vui lòng chuyển sang đúng mạng để tiếp tục.");
    }

    const attemptId = makeAttemptId();
    activeAttemptIdRef.current = attemptId;
    setError(null);

    try {
      const noncePayload = await requestNonce();
      const signature = await signNonceMessage(attemptId, noncePayload);
      return await verifyWalletSignature(attemptId, noncePayload, signature);
    } catch (flowError) {
      if (!mountedRef.current) throw flowError;
      const parsed = classifyWalletError(flowError);
      if (parsed.code !== "pending_request") {
        setError({ ...parsed, recoverable: true });
        if (parsed.code !== "wrong_chain") {
          setBasePhase("error");
        }
      }
      throw flowError;
    }
  }, [authMode, connectedAddress, effectivePhase, ensureSupportedChain, isConnected, requestNonce, signNonceMessage, verifyWalletSignature]);

  const retryCurrentStep = useCallback(async () => {
    if (signLockRef.current || effectivePhase === "signing_pending_wallet") {
      setPendingRequestDetected(true);
      setBasePhase("signing_pending_wallet");
      throw new Error("Yêu cầu ký đang chờ xử lý trong MetaMask. Vui lòng mở lại cửa sổ xác nhận trong ví để tiếp tục.");
    }

    if (effectivePhase === "verifying" && nonceRef.current && signatureRef.current && activeAttemptIdRef.current) {
      return verifyWalletSignature(activeAttemptIdRef.current, nonceRef.current, signatureRef.current);
    }

    resetWalletAuthFlow("retry");
    return startWalletLoginFlow();
  }, [effectivePhase, resetWalletAuthFlow, startWalletLoginFlow, verifyWalletSignature]);

  const resumePendingFlowCheck = useCallback(async () => {
    if (effectivePhase === "verifying" && nonceRef.current && signatureRef.current && activeAttemptIdRef.current) {
      return verifyWalletSignature(activeAttemptIdRef.current, nonceRef.current, signatureRef.current);
    }

    if (effectivePhase === "signing" || effectivePhase === "signing_pending_wallet" || pendingRequestDetected) {
      setWasBackgroundedDuringSign(true);
      return null;
    }

    if (effectivePhase === "error" && error?.code === "verification_failed" && nonceRef.current && signatureRef.current && activeAttemptIdRef.current) {
      return verifyWalletSignature(activeAttemptIdRef.current, nonceRef.current, signatureRef.current);
    }

    return null;
  }, [effectivePhase, error?.code, pendingRequestDetected, verifyWalletSignature]);

  const disconnectWallet = useCallback(async () => {
    if (authMode === "injected_mobile_browser") {
      setInjectedAddress(null);
      setInjectedChainId(null);
    }
    resetWalletAuthFlow("disconnect");
    await fullWalletDisconnect(disconnect);
  }, [authMode, disconnect, resetWalletAuthFlow]);

  const switchWalletAccount = useCallback(async () => {
    setIsSwitchingWallet(true);
    resetWalletAuthFlow("switch_wallet");
    clearWalletLocalStorage();

    try {
      const result = await requestWalletSwitch(connectedAddress);
      if (authMode === "injected_mobile_browser") {
        await syncInjectedState(false);
      }
      logWalletAuth("switch_wallet", {
        connectorType,
        account: connectedAddress,
        chainId: effectiveChainId ?? null,
        switched: result.switched,
        fallbackUsed: result.fallbackUsed,
        authMode,
      });
      return result;
    } finally {
      setIsSwitchingWallet(false);
    }
  }, [authMode, connectedAddress, connectorType, effectiveChainId, resetWalletAuthFlow, syncInjectedState]);

  const linkWallet = useCallback(async (): Promise<LinkWalletResult> => {
    if (!isConnected || !connectedAddress || !isValidEvmAddress(connectedAddress)) {
      throw new Error("Vui lòng kết nối ví trước khi liên kết.");
    }
    if (!isSupportedAuthChain(effectiveChainId)) {
      throw new Error("Vui lòng chuyển sang đúng mạng để tiếp tục.");
    }

    setIsLinking(true);
    try {
      const wallet = await linkWalletWithSharedFlow({
        address: connectedAddress,
        chainId: effectiveChainId ?? AUTH_CHAIN_ID,
        connectorType,
        signMessageAsync: async ({ account, message }) => {
          if (authMode === "injected_mobile_browser" && injectedProvider && account) {
            return requestPersonalSign({
              provider: injectedProvider,
              account,
              message,
            });
          }
          return signMessageAsync({ account, message });
        },
      });
      await refresh();
      return wallet;
    } finally {
      setIsLinking(false);
    }
  }, [authMode, connectedAddress, connectorType, effectiveChainId, injectedProvider, isConnected, refresh, signMessageAsync]);

  const unlinkWallet = useCallback(
    async (walletId: string) => {
      const { error: deleteError } = await supabase.from("user_wallets").delete().eq("id", walletId);
      if (deleteError) {
        throw new Error(deleteError.message || "Unable to unlink wallet");
      }
      await refresh();
    },
    [refresh],
  );

  const setPrimaryWallet = useCallback(
    async (walletId: string) => {
      if (!sessionUserId) {
        throw new Error("Please sign in first");
      }

      const currentWalletIds = linkedWallets.map((wallet) => wallet.id);
      if (currentWalletIds.length === 0) return;

      const { error: resetError } = await supabase
        .from("user_wallets")
        .update({ is_primary: false })
        .eq("user_id", sessionUserId)
        .in("id", currentWalletIds);

      if (resetError) {
        throw new Error(resetError.message || "Unable to unset primary wallet");
      }

      const { error: setError } = await supabase
        .from("user_wallets")
        .update({ is_primary: true })
        .eq("id", walletId)
        .eq("user_id", sessionUserId);

      if (setError) {
        throw new Error(setError.message || "Unable to set primary wallet");
      }

      await refresh();
    },
    [linkedWallets, refresh, sessionUserId],
  );

  return {
    authMode,
    sessionUserId,
    linkedWallets,
    isLoadingWallets,
    isConnected,
    connectedAddress,
    connectorType,
    chainId: effectiveChainId,
    isSupportedChain: isSupportedAuthChain(effectiveChainId),
    expectedChainId: AUTH_CHAIN_ID,
    phase: effectivePhase,
    error,
    nonceExpiresAt,
    isLinking,
    isSigning: signLockRef.current || wagmiSigning,
    isVerifying: verifyLockRef.current,
    isSwitchingWallet,
    isSwitchingChain: authMode === "wallet_modal_or_walletconnect" ? isSwitchingChain : false,
    pendingRequestDetected,
    wasBackgroundedDuringSign,
    connectWallet,
    ensureSupportedChain,
    requestNonce,
    signNonceMessage,
    verifyWalletSignature,
    startWalletLoginFlow,
    retryCurrentStep,
    resumePendingFlowCheck,
    switchWalletAccount,
    resetWalletAuthFlow,
    disconnectWallet,
    linkWallet,
    unlinkWallet,
    setPrimaryWallet,
    refresh,
  };
}
