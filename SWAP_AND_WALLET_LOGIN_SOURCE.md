# Mobile Wallet Login Source Package

Tai lieu nay dong goi day du source code cho tinh nang dang nhap bang vi tren dien thoai, tap trung vao MetaMask mobile dApp browser, Trust Wallet mobile browser, va flow WalletConnect/wagmi lien quan.

## Included Files

- `src/features/auth/wallet/WalletLoginPanel.tsx`
- `src/features/auth/wallet/useWalletAuth.ts`
- `src/features/auth/wallet/walletFlowShared.ts`
- `src/utils/mobileWalletConnect.ts`

## src/features/auth/wallet/WalletLoginPanel.tsx

```tsx
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { WalletConnectButton } from "./WalletConnectButton";
import { WrongNetworkBanner } from "./WrongNetworkBanner";
import { useWalletAuth } from "./useWalletAuth";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Shield,
  Wallet,
} from "lucide-react";
import {
  getMetaMaskDeepLink,
  getTrustWalletDeepLink,
  getWalletAppLinks,
  isMetaMaskMobileBrowser,
  isMobileDevice,
  isTrustWalletMobileBrowser,
} from "@/utils/mobileWalletConnect";

interface WalletLoginPanelProps {
  onSuccess?: (userId: string, isNewUser: boolean, needsEmailVerification: boolean) => void;
}

const STEPS = [
  { key: "connect", label: "Káº¿t ná»‘i" },
  { key: "network", label: "Máº¡ng" },
  { key: "sign", label: "KÃ½" },
  { key: "done", label: "Xong" },
] as const;

function getActiveStep(state: ReturnType<typeof useWalletAuth>["phase"]) {
  switch (state) {
    case "idle":
    case "connecting":
      return 0;
    case "connected":
    case "wrong_chain":
      return 1;
    case "ready_to_sign":
    case "signing":
    case "signing_pending_wallet":
    case "verifying":
    case "error":
      return 2;
    case "authenticated":
      return 3;
    default:
      return 0;
  }
}

function StepProgressBar({ state }: { state: ReturnType<typeof useWalletAuth>["phase"] }) {
  const activeStep = getActiveStep(state);

  return (
    <div className="mb-4 flex items-center justify-center gap-1">
      {STEPS.map((step, index) => {
        const isActive = index === activeStep;
        const isDone = index < activeStep;

        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium transition-all ${
                  isDone
                    ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                    : isActive
                      ? "border-primary/40 bg-primary/20 text-primary"
                      : "border-border/50 bg-muted/50 text-muted-foreground/50"
                }`}
              >
                {isDone ? "âœ“" : index + 1}
              </div>
              <span className={`text-[10px] leading-tight ${isDone ? "text-emerald-400" : isActive ? "text-primary" : "text-muted-foreground/50"}`}>
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`mt-[-12px] h-px w-4 ${isDone ? "bg-emerald-500/40" : "bg-border/50"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function WalletLoginPanel({ onSuccess }: WalletLoginPanelProps) {
  const auth = useWalletAuth();
  const isMobile = isMobileDevice();
  const inMetaMaskMobile = isMetaMaskMobileBrowser();
  const inTrustWalletMobile = isTrustWalletMobileBrowser();
  const inInjectedMobileBrowser = auth.authMode === "injected_mobile_browser";

  const shortAddr = auth.connectedAddress
    ? `${auth.connectedAddress.slice(0, 6)}...${auth.connectedAddress.slice(-4)}`
    : "";

  const helperText = useMemo(() => {
    if (auth.phase === "connecting") {
      return inMetaMaskMobile ? "Báº¡n Ä‘ang á»Ÿ trong MetaMask. HÃ£y káº¿t ná»‘i vÃ­ Ä‘á»ƒ tiáº¿p tá»¥c." : "Äang káº¿t ná»‘i vÃ­...";
    }
    if (auth.phase === "signing") {
      return auth.wasBackgroundedDuringSign
        ? "Vui lÃ²ng xÃ¡c nháº­n chá»¯ kÃ½ trong vÃ­ cá»§a báº¡n."
        : "Äang má»Ÿ vÃ­ Ä‘á»ƒ xÃ¡c nháº­n...";
    }
    if (auth.phase === "signing_pending_wallet" || auth.pendingRequestDetected) {
      return "YÃªu cáº§u kÃ½ Ä‘ang chá» xá»­ lÃ½ trong MetaMask. Vui lÃ²ng má»Ÿ láº¡i cá»­a sá»• xÃ¡c nháº­n trong vÃ­ Ä‘á»ƒ tiáº¿p tá»¥c.";
    }
    if (auth.phase === "verifying") {
      return "Äang xÃ¡c thá»±c chá»¯ kÃ½ vÃ  táº¡o phiÃªn Ä‘Äƒng nháº­p...";
    }
    return null;
  }, [auth.pendingRequestDetected, auth.phase, auth.wasBackgroundedDuringSign, inMetaMaskMobile]);

  const handleConnectInjected = async () => {
    try {
      await auth.connectWallet();
      toast.success(inMetaMaskMobile ? "ÄÃ£ káº¿t ná»‘i MetaMask." : "ÄÃ£ káº¿t ná»‘i vÃ­.");
    } catch (error: any) {
      toast.error(error?.message || "KhÃ´ng thá»ƒ káº¿t ná»‘i vÃ­.");
    }
  };

  const handleLogin = async () => {
    try {
      const result = await auth.startWalletLoginFlow();
      toast.success("ÄÄƒng nháº­p vÃ­ thÃ nh cÃ´ng.");
      onSuccess?.(result.user_id, result.isNewUser, result.needsEmailVerification);
    } catch (error: any) {
      const message = error?.message || auth.error?.message || "KhÃ´ng thá»ƒ Ä‘Äƒng nháº­p báº±ng vÃ­.";
      if (auth.phase === "signing_pending_wallet" || auth.pendingRequestDetected) {
        toast.warning("YÃªu cáº§u kÃ½ Ä‘ang chá» xá»­ lÃ½ trong MetaMask. Vui lÃ²ng má»Ÿ láº¡i cá»­a sá»• xÃ¡c nháº­n trong vÃ­ Ä‘á»ƒ tiáº¿p tá»¥c.");
        return;
      }
      toast.error(message);
    }
  };

  const handleRetry = async () => {
    try {
      const result = await auth.retryCurrentStep();
      if (result) {
        toast.success("ÄÄƒng nháº­p vÃ­ thÃ nh cÃ´ng.");
        onSuccess?.(result.user_id, result.isNewUser, result.needsEmailVerification);
      }
    } catch (error: any) {
      toast.error(error?.message || auth.error?.message || "KhÃ´ng thá»ƒ thá»­ láº¡i.");
    }
  };

  const handleResumeCheck = async () => {
    try {
      const result = await auth.resumePendingFlowCheck();
      if (result) {
        toast.success("ÄÄƒng nháº­p vÃ­ thÃ nh cÃ´ng.");
        onSuccess?.(result.user_id, result.isNewUser, result.needsEmailVerification);
      } else {
        toast.info("Vui lÃ²ng xÃ¡c nháº­n chá»¯ kÃ½ trong vÃ­ cá»§a báº¡n.");
      }
    } catch (error: any) {
      toast.error(error?.message || "KhÃ´ng thá»ƒ kiá»ƒm tra láº¡i tráº¡ng thÃ¡i kÃ½.");
    }
  };

  const handleSwitchWallet = async () => {
    try {
      const result = await auth.switchWalletAccount();
      if (result.cancelled) {
        toast.info("Báº¡n Ä‘Ã£ há»§y chá»n vÃ­.");
        return;
      }
      if (result.switched) {
        toast.success("ÄÃ£ chuyá»ƒn sang vÃ­ má»›i.");
        return;
      }
      if (result.fallbackUsed) {
        toast("Vui lÃ²ng chá»n tÃ i khoáº£n khÃ¡c trong vÃ­ rá»“i quay láº¡i á»©ng dá»¥ng.", { duration: 6000 });
        return;
      }
      toast.info("VÃ­ hiá»‡n táº¡i váº«n Ä‘Æ°á»£c giá»¯ nguyÃªn.");
    } catch (error: any) {
      toast.error(error?.message || "KhÃ´ng thá»ƒ Ä‘á»•i vÃ­.");
    }
  };

  if (auth.phase === "idle" || auth.phase === "connecting") {
    if (inInjectedMobileBrowser) {
      return (
        <div className="space-y-4">
          <StepProgressBar state={auth.phase} />
          <p className="text-center text-sm text-muted-foreground">
            {inMetaMaskMobile
              ? "Báº¡n Ä‘ang á»Ÿ trong MetaMask. HÃ£y káº¿t ná»‘i vÃ­ Ä‘á»ƒ tiáº¿p tá»¥c."
              : inTrustWalletMobile
                ? "Báº¡n Ä‘ang á»Ÿ trong Trust Wallet. HÃ£y káº¿t ná»‘i vÃ­ Ä‘á»ƒ tiáº¿p tá»¥c."
                : "Báº¡n Ä‘ang á»Ÿ trong trÃ¬nh duyá»‡t vÃ­. HÃ£y káº¿t ná»‘i vÃ­ Ä‘á»ƒ tiáº¿p tá»¥c."}
          </p>

          <Button className="w-full" onClick={() => void handleConnectInjected()} disabled={auth.phase === "connecting"}>
            {auth.phase === "connecting" ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={16} />
                Äang káº¿t ná»‘i vÃ­...
              </>
            ) : (
              <>
                <Wallet className="mr-2" size={16} />
                {inMetaMaskMobile ? "Káº¿t ná»‘i MetaMask" : "Káº¿t ná»‘i vÃ­"}
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            KhÃ´ng cáº§n má»Ÿ láº¡i á»©ng dá»¥ng vÃ­. Báº¡n Ä‘Ã£ á»Ÿ Ä‘Ãºng trong trÃ¬nh duyá»‡t dApp cá»§a vÃ­.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <StepProgressBar state={auth.phase} />

        {isMobile ? (
          <>
            <p className="text-center text-sm text-muted-foreground">Má»Ÿ á»©ng dá»¥ng vÃ­ hoáº·c quÃ©t QR Ä‘á»ƒ káº¿t ná»‘i</p>

            <a
              href={getMetaMaskDeepLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Wallet size={16} />
              Má»Ÿ trong MetaMask
              <ExternalLink size={14} />
            </a>

            <a
              href={getTrustWalletDeepLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              <Shield size={16} />
              Má»Ÿ trong Trust Wallet
              <ExternalLink size={14} />
            </a>

            <WalletConnectButton className="w-full" label="Káº¿t ná»‘i qua WalletConnect" isLoading={auth.phase === "connecting"} onConnectStart={() => void auth.connectWallet()} />

            <div className="border-t border-border/50 pt-3">
              <p className="mb-2 text-center text-xs text-muted-foreground">ChÆ°a cÃ³ vÃ­? Táº£i á»©ng dá»¥ng vÃ­</p>
              <div className="flex justify-center gap-2 text-xs">
                <a href={getWalletAppLinks().metamask.android} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  MetaMask
                </a>
                <span className="text-muted-foreground/30">|</span>
                <a href={getWalletAppLinks().trustWallet.android} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Trust Wallet
                </a>
              </div>
            </div>
          </>
        ) : (
          <>
            <WalletConnectButton className="w-full" label="Káº¿t ná»‘i vÃ­ / Connect Wallet" isLoading={auth.phase === "connecting"} onConnectStart={() => void auth.connectWallet()} />
            <p className="text-center text-xs text-muted-foreground">MetaMask, Trust Wallet, WalletConnect vÃ  cÃ¡c vÃ­ khÃ¡c</p>
          </>
        )}
      </div>
    );
  }

  if (auth.phase === "wrong_chain") {
    return (
      <div className="space-y-4">
        <StepProgressBar state={auth.phase} />
        <WrongNetworkBanner show chainId={auth.chainId} />

        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Wallet size={16} className="shrink-0" />
          <span className="truncate">{shortAddr}</span>
        </div>

        <Button className="w-full" onClick={() => void auth.ensureSupportedChain()} disabled={auth.isSwitchingChain}>
          {auth.isSwitchingChain ? (
            <>
              <Loader2 className="mr-2 animate-spin" size={16} />
              Äang chuyá»ƒn máº¡ng...
            </>
          ) : (
            "Chuyá»ƒn sang BNB Smart Chain"
          )}
        </Button>

        <Button variant="outline" className="w-full" onClick={() => void handleSwitchWallet()} disabled={auth.isSwitchingWallet}>
          <RefreshCw size={14} />
          Äá»•i vÃ­ khÃ¡c
        </Button>

        <button type="button" onClick={() => void auth.disconnectWallet()} className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
          Ngáº¯t káº¿t ná»‘i
        </button>
      </div>
    );
  }

  if (auth.phase === "signing" || auth.phase === "signing_pending_wallet" || auth.phase === "verifying") {
    return (
      <div className="space-y-4">
        <StepProgressBar state={auth.phase} />
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 className="animate-spin text-primary" size={36} />
          <p className="text-sm font-medium text-foreground">{helperText}</p>
          <p className="max-w-[300px] text-center text-xs text-muted-foreground">
            {auth.phase === "signing_pending_wallet"
              ? "MetaMask váº«n Ä‘ang giá»¯ yÃªu cáº§u kÃ½ trÆ°á»›c Ä‘Ã³. Äá»«ng báº¥m kÃ½ nhiá»u láº§n. HÃ£y quay láº¡i cá»­a sá»• xÃ¡c nháº­n trong vÃ­."
              : "YÃªu cáº§u kÃ½ nÃ y khÃ´ng tá»‘n gas. Náº¿u báº¡n vá»«a quay láº¡i tá»« vÃ­, hÃ£y dÃ¹ng nÃºt kiá»ƒm tra láº¡i thay vÃ¬ táº¡o yÃªu cáº§u kÃ½ má»›i."}
          </p>
        </div>

        {isMobile && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Há»— trá»£ cho trÃ¬nh duyá»‡t vÃ­ trÃªn Ä‘iá»‡n thoáº¡i</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <a
                href={getMetaMaskDeepLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium"
              >
                <Wallet size={14} />
                Má»Ÿ láº¡i MetaMask
              </a>
              {!inMetaMaskMobile && (
                <a
                  href={getTrustWalletDeepLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium"
                >
                  <Shield size={14} />
                  Má»Ÿ láº¡i Trust Wallet
                </a>
              )}
            </div>
            <Button variant="outline" className="w-full" onClick={() => void handleResumeCheck()}>
              TÃ´i Ä‘Ã£ xÃ¡c nháº­n
            </Button>
            <Button variant="outline" className="w-full" onClick={() => void handleSwitchWallet()} disabled={auth.isSwitchingWallet}>
              Äá»•i vÃ­ khÃ¡c
            </Button>
            <button type="button" onClick={() => void auth.disconnectWallet()} className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
              Ngáº¯t káº¿t ná»‘i
            </button>
          </div>
        )}

        <button type="button" onClick={() => auth.resetWalletAuthFlow("retry")} className="flex w-full items-center justify-center gap-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft size={12} />
          Quay láº¡i
        </button>
      </div>
    );
  }

  if (auth.phase === "authenticated") {
    return (
      <div className="space-y-4">
        <StepProgressBar state={auth.phase} />
        <div className="flex flex-col items-center gap-3 py-6">
          <CheckCircle2 className="text-emerald-400" size={40} />
          <p className="text-sm font-medium text-foreground">ÄÄƒng nháº­p vÃ­ thÃ nh cÃ´ng.</p>
        </div>
      </div>
    );
  }

  if (auth.phase === "error") {
    return (
      <div className="space-y-4">
        <StepProgressBar state={auth.phase} />
        <div className="flex flex-col items-center gap-2 py-4">
          <AlertCircle className="text-destructive" size={36} />
          <p className="text-sm font-medium text-foreground">XÃ¡c thá»±c tháº¥t báº¡i</p>
          {auth.error?.message && <p className="max-w-[300px] text-center text-xs text-muted-foreground">{auth.error.message}</p>}
        </div>

        {auth.pendingRequestDetected ? (
          <>
            <Button className="w-full" variant="outline" onClick={() => void handleResumeCheck()}>
              Kiá»ƒm tra láº¡i
            </Button>
            <Button variant="outline" className="w-full" onClick={() => void handleSwitchWallet()} disabled={auth.isSwitchingWallet}>
              Äá»•i vÃ­ khÃ¡c
            </Button>
          </>
        ) : (
          <Button className="w-full" onClick={() => void handleRetry()} disabled={auth.isSigning || auth.isVerifying}>
            Thá»­ láº¡i
          </Button>
        )}

        <button type="button" onClick={() => void auth.disconnectWallet()} className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
          Ngáº¯t káº¿t ná»‘i
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StepProgressBar state={auth.phase} />

      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-sm font-medium text-foreground">ÄÃ£ káº¿t ná»‘i vÃ­</span>
        </div>

        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
          <Wallet size={16} className="shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-foreground">{shortAddr}</span>
          <CheckCircle2 size={14} className="ml-auto shrink-0 text-emerald-400" />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Máº¡ng:</span>
          <span className="font-medium text-foreground">BNB Smart Chain</span>
        </div>
      </div>

      <Button className="w-full" onClick={() => void handleLogin()} disabled={auth.isSigning || auth.isVerifying}>
        {auth.isSigning || auth.isVerifying ? "Äang xá»­ lÃ½..." : "KÃ½ vÃ  Ä‘Äƒng nháº­p"}
      </Button>

      <Button variant="outline" className="w-full" onClick={() => void handleSwitchWallet()} disabled={auth.isSwitchingWallet}>
        <RefreshCw size={14} />
        Äá»•i vÃ­ khÃ¡c
      </Button>

      <button type="button" onClick={() => void auth.disconnectWallet()} className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
        Ngáº¯t káº¿t ná»‘i
      </button>
    </div>
  );
}
```

## src/features/auth/wallet/useWalletAuth.ts

```ts
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
      throw new Error("KhÃ´ng tÃ¬m tháº¥y MetaMask hoáº·c vÃ­ in-app há»— trá»£.");
    }
    setBasePhase("connecting");
    setError(null);

    const state = await syncInjectedState(true);
    if (!state?.address) {
      throw new Error("KhÃ´ng thá»ƒ láº¥y tÃ i khoáº£n vÃ­ tá»« MetaMask.");
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
      message: "Vui lÃ²ng chuyá»ƒn sang Ä‘Ãºng máº¡ng Ä‘á»ƒ tiáº¿p tá»¥c.",
      recoverable: true,
    });

    try {
      if (authMode === "injected_mobile_browser") {
        if (!injectedProvider) throw new Error("Wallet provider not available");
        const result = await ensureBscNetwork({ provider: injectedProvider, preferredChainId: bsc.id });
        setInjectedChainId(result.chainId);
        if (!result.ok || result.chainId !== AUTH_CHAIN_ID) {
          throw new Error("Vui lÃ²ng chuyá»ƒn sang Ä‘Ãºng máº¡ng Ä‘á»ƒ tiáº¿p tá»¥c.");
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
      throw new Error("Vui lÃ²ng káº¿t ná»‘i vÃ­ trÆ°á»›c.");
    }
    if (!isSupportedAuthChain(effectiveChainId)) {
      throw new Error("Vui lÃ²ng chuyá»ƒn sang Ä‘Ãºng máº¡ng Ä‘á»ƒ tiáº¿p tá»¥c.");
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
        throw new Error("VÃ­ Ä‘Ã£ bá»‹ ngáº¯t káº¿t ná»‘i.");
      }

      if (signLockRef.current) {
        throw new Error("YÃªu cáº§u kÃ½ Ä‘ang chá» xá»­ lÃ½ trong MetaMask. Vui lÃ²ng má»Ÿ láº¡i cá»­a sá»• xÃ¡c nháº­n trong vÃ­ Ä‘á»ƒ tiáº¿p tá»¥c.");
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
          throw new Error("TÃ i khoáº£n vÃ­ Ä‘Ã£ thay Ä‘á»•i. Vui lÃ²ng thá»­ láº¡i.");
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
        throw new Error("Äang xÃ¡c thá»±c vÃ­. Vui lÃ²ng chá».");
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
          throw new Error("TÃ i khoáº£n vÃ­ Ä‘Ã£ thay Ä‘á»•i. Vui lÃ²ng thá»­ láº¡i.");
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
      throw new Error("Báº¡n Ä‘ang á»Ÿ trong MetaMask. HÃ£y káº¿t ná»‘i vÃ­ Ä‘á»ƒ tiáº¿p tá»¥c.");
    }
    if (!connectedAddress || !isConnected) {
      throw new Error("Vui lÃ²ng káº¿t ná»‘i vÃ­ trÆ°á»›c.");
    }

    if (signLockRef.current || effectivePhase === "signing_pending_wallet") {
      const pendingError = {
        code: "pending_request" as const,
        message: "YÃªu cáº§u kÃ½ Ä‘ang chá» xá»­ lÃ½ trong MetaMask. Vui lÃ²ng má»Ÿ láº¡i cá»­a sá»• xÃ¡c nháº­n trong vÃ­ Ä‘á»ƒ tiáº¿p tá»¥c.",
        recoverable: true,
      };
      setPendingRequestDetected(true);
      setError(pendingError);
      setBasePhase("signing_pending_wallet");
      throw new Error(pendingError.message);
    }

    const chainOk = await ensureSupportedChain();
    if (!chainOk) {
      throw new Error("Vui lÃ²ng chuyá»ƒn sang Ä‘Ãºng máº¡ng Ä‘á»ƒ tiáº¿p tá»¥c.");
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
      throw new Error("YÃªu cáº§u kÃ½ Ä‘ang chá» xá»­ lÃ½ trong MetaMask. Vui lÃ²ng má»Ÿ láº¡i cá»­a sá»• xÃ¡c nháº­n trong vÃ­ Ä‘á»ƒ tiáº¿p tá»¥c.");
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
      throw new Error("Vui lÃ²ng káº¿t ná»‘i vÃ­ trÆ°á»›c khi liÃªn káº¿t.");
    }
    if (!isSupportedAuthChain(effectiveChainId)) {
      throw new Error("Vui lÃ²ng chuyá»ƒn sang Ä‘Ãºng máº¡ng Ä‘á»ƒ tiáº¿p tá»¥c.");
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
```

## src/features/auth/wallet/walletFlowShared.ts

```ts
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

  return (
    candidate.code ??
    candidate.cause?.code ??
    candidate.data?.code ??
    candidate.data?.originalError?.code ??
    null
  );
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
  const message = rawMessage.trim() || "ÄÃ£ cÃ³ lá»—i xáº£y ra trong quÃ¡ trÃ¬nh xÃ¡c thá»±c vÃ­.";
  const lower = message.toLowerCase();
  const code = extractWalletErrorCode(error);

  if (
    code === -32002 ||
    lower.includes("already pending") ||
    lower.includes("request of type 'personal_sign' already pending")
  ) {
    return {
      code: "pending_request",
      message: "YÃªu cáº§u kÃ½ Ä‘ang chá» xá»­ lÃ½ trong MetaMask. Vui lÃ²ng má»Ÿ láº¡i cá»­a sá»• xÃ¡c nháº­n trong vÃ­ Ä‘á»ƒ tiáº¿p tá»¥c.",
    };
  }

  if (code === 4001 || lower.includes("user rejected") || lower.includes("rejected the request") || lower.includes("há»§y")) {
    return {
      code: "user_rejected",
      message: "Báº¡n Ä‘Ã£ há»§y xÃ¡c nháº­n chá»¯ kÃ½.",
    };
  }

  if (lower.includes("nonce") && lower.includes("expired")) {
    return {
      code: "nonce_expired",
      message: "Nonce Ä‘Ã£ háº¿t háº¡n. Vui lÃ²ng thá»­ láº¡i Ä‘á»ƒ nháº­n yÃªu cáº§u kÃ½ má»›i.",
    };
  }

  if (lower.includes("nonce")) {
    return {
      code: "nonce_invalid",
      message: "Nonce khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng. Vui lÃ²ng thá»­ láº¡i.",
    };
  }

  if (lower.includes("wrong_chain") || lower.includes("Ä‘Ãºng máº¡ng") || lower.includes("wrong network")) {
    return {
      code: "wrong_chain",
      message: "Vui lÃ²ng chuyá»ƒn sang Ä‘Ãºng máº¡ng Ä‘á»ƒ tiáº¿p tá»¥c.",
    };
  }

  if (lower.includes("wallet_not_linked")) {
    return {
      code: "wallet_not_linked",
      message: "VÃ­ nÃ y chÆ°a Ä‘Æ°á»£c liÃªn káº¿t vá»›i tÃ i khoáº£n nÃ o.",
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
    throw new Error((data as { error?: string } | null)?.error || error.message || "KhÃ´ng thá»ƒ táº¡o nonce.");
  }

  const payload = data as NoncePayload & { error?: string };
  if (!payload?.nonce || !payload?.message) {
    throw new Error(payload?.error || "Pháº£n há»“i nonce khÃ´ng há»£p lá»‡.");
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
    throw new Error((data as { error?: string } | null)?.error || error.message || "KhÃ´ng thá»ƒ xÃ¡c thá»±c vÃ­.");
  }

  const payload = data as {
    ok?: boolean;
    error?: string;
    code?: string;
    user_id?: string;
    isNewUser?: boolean;
    needsEmailVerification?: boolean;
    auth?: { token_hash?: string | null };
  };

  if (!payload?.ok || !payload.auth?.token_hash || !payload.user_id) {
    throw new Error(payload?.error || "KhÃ´ng thá»ƒ hoÃ n táº¥t xÃ¡c thá»±c vÃ­.");
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
    throw new Error((data as { error?: string } | null)?.error || error.message || "KhÃ´ng thá»ƒ liÃªn káº¿t vÃ­.");
  }

  const payload = data as { ok?: boolean; wallet?: LinkWalletResult; error?: string };
  if (!payload?.ok || !payload.wallet) {
    throw new Error(payload?.error || "LiÃªn káº¿t vÃ­ tháº¥t báº¡i.");
  }

  return payload.wallet;
}

export async function completeSupabaseWalletSession(tokenHash: string) {
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  if (error) {
    throw new Error(error.message || "KhÃ´ng thá»ƒ táº¡o phiÃªn Ä‘Äƒng nháº­p.");
  }
}

export async function linkWalletWithSharedFlow(input: {
  address: string;
  chainId: number | null;
  signMessageAsync: (args: { account: `0x${string}`; message: string }) => Promise<string>;
  connectorType?: string;
}) {
  if (linkSignLock) {
    throw new Error("YÃªu cáº§u kÃ½ Ä‘ang chá» xá»­ lÃ½ trong vÃ­. Vui lÃ²ng má»Ÿ láº¡i MetaMask/Trust Wallet Ä‘á»ƒ xÃ¡c nháº­n.");
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
```

## src/utils/mobileWalletConnect.ts

```ts
import { bsc, mainnet } from 'wagmi/chains';

type OpenConnectModal = (() => void) | undefined;
export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
};

type WagmiConnectorLike = {
  name?: string;
  getProvider?: () => Promise<unknown> | unknown;
};

const bscRpcUrl = (import.meta.env.VITE_BSC_RPC_URL || 'https://bsc-dataseed.binance.org').trim();
const BSC_TESTNET_RPC_URL = 'https://data-seed-prebsc-1-s1.binance.org:8545';

export const SUPPORTED_CHAIN_IDS = [bsc.id, 97, mainnet.id] as const;
export const PWA_RECONNECT_HINT = 'Refresh trang hoac Disconnect -> Connect lai tu wallet app.';
export const MODAL_OPEN_FAILED_HINT = 'Khong the mo modal ket noi vi. Vui long thu lai.';

type NetworkResolveDebugContext = {
  connectorName?: string;
  isPwa: boolean;
  reason?: string;
};

const CHAIN_PARAMS: Record<number, {
  chainIdHex: string;
  chainName: string;
  rpcUrls: string[];
  blockExplorerUrls: string[];
}> = {
  56: {
    chainIdHex: '0x38',
    chainName: 'BNB Smart Chain',
    rpcUrls: [bscRpcUrl],
    blockExplorerUrls: ['https://bscscan.com'],
  },
  97: {
    chainIdHex: '0x61',
    chainName: 'BNB Smart Chain Testnet',
    rpcUrls: [BSC_TESTNET_RPC_URL],
    blockExplorerUrls: ['https://testnet.bscscan.com'],
  },
};

export function isInjectedAvailable(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).ethereum !== 'undefined';
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandaloneDisplayMode = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const isIosStandalone = Boolean((window.navigator as any)?.standalone);
  return Boolean(isStandaloneDisplayMode || isIosStandalone);
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function isMetaMaskMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const eth = (window as any).ethereum;
  return Boolean(eth?.isMetaMask) && isMobileDevice();
}

export function isTrustWalletMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const eth = (window as any).ethereum;
  return Boolean(eth?.isTrust || eth?.isTrustWallet) && isMobileDevice();
}

export function getInjectedProvider(): Eip1193Provider | null {
  if (!isInjectedAvailable()) return null;
  return (window as any).ethereum as Eip1193Provider;
}

export function isInjectedMobileBrowser(): boolean {
  return isMetaMaskMobileBrowser() || isTrustWalletMobileBrowser();
}

export function getInjectedMobileBrowserType(): 'metamask' | 'trustwallet' | 'unknown' {
  const provider = getInjectedProvider();
  if (!provider) return 'unknown';
  if (provider.isMetaMask) return 'metamask';
  if (provider.isTrust || provider.isTrustWallet) return 'trustwallet';
  return 'unknown';
}

export function getMetaMaskDeepLink(): string {
  if (typeof window === 'undefined') return '';
  return `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
}

export function connectWalletViaRainbowModal(openConnectModal: OpenConnectModal): boolean {
  if (!openConnectModal) return false;
  openConnectModal();
  return true;
}

export async function resolveWalletProvider(connector?: WagmiConnectorLike | null): Promise<Eip1193Provider | null> {
  if (connector?.getProvider) {
    const provider = await connector.getProvider();
    if (provider && typeof provider === 'object' && 'request' in provider) {
      return provider as Eip1193Provider;
    }
  }

  if (isInjectedAvailable()) {
    return (window as any).ethereum as Eip1193Provider;
  }

  return null;
}

export async function getInjectedAccounts(provider?: Eip1193Provider | null): Promise<string[]> {
  const eth = provider ?? getInjectedProvider();
  if (!eth) return [];
  try {
    const accounts = await eth.request({ method: 'eth_accounts' });
    return Array.isArray(accounts) ? (accounts as string[]) : [];
  } catch {
    return [];
  }
}

export async function requestInjectedAccounts(provider?: Eip1193Provider | null): Promise<string[]> {
  const eth = provider ?? getInjectedProvider();
  if (!eth) return [];
  const accounts = await eth.request({ method: 'eth_requestAccounts' });
  return Array.isArray(accounts) ? (accounts as string[]) : [];
}

export function normalizeChainId(rawChainId: unknown): number | null {
  if (typeof rawChainId === 'number' && Number.isFinite(rawChainId)) {
    return rawChainId;
  }

  if (typeof rawChainId !== 'string') return null;
  const value = rawChainId.trim();
  if (!value) return null;

  if (value.startsWith('0x') || value.startsWith('0X')) {
    const parsedHex = Number.parseInt(value, 16);
    return Number.isFinite(parsedHex) ? parsedHex : null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getChainId(provider: Eip1193Provider | null | undefined): Promise<number | null> {
  if (!provider) return null;
  try {
    const raw = await provider.request({ method: 'eth_chainId' });
    return normalizeChainId(raw);
  } catch {
    return null;
  }
}

export function isSupportedChain(chainId: number | null | undefined): boolean {
  if (!chainId) return false;
  return SUPPORTED_CHAIN_IDS.includes(chainId as (typeof SUPPORTED_CHAIN_IDS)[number]);
}

export function formatNetworkResolveDebug(context: NetworkResolveDebugContext): string {
  const connector = context.connectorName || 'unknown';
  const reason = context.reason || 'unknown';
  const pwa = context.isPwa ? 'standalone' : 'browser';
  return `[DEV] Chain resolve failed (${reason}). connector=${connector}, mode=${pwa}. Try refresh/reconnect.`;
}

type EnsureBscParams = {
  provider?: Eip1193Provider | null;
  preferredChainId?: number;
};

function getErrorCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'number') return code;
  if (typeof code === 'string') {
    const parsed = Number.parseInt(code, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function switchToChain(provider: Eip1193Provider, targetChainId: number): Promise<boolean> {
  const chainConfig = CHAIN_PARAMS[targetChainId] || CHAIN_PARAMS[bsc.id];
  const chainIdHex = chainConfig?.chainIdHex || `0x${targetChainId.toString(16)}`;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
    return true;
  } catch (error) {
    if (getErrorCode(error) !== 4902) return false;

    try {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainIdHex,
          chainName: chainConfig.chainName,
          nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
          rpcUrls: chainConfig.rpcUrls,
          blockExplorerUrls: chainConfig.blockExplorerUrls,
        }],
      });
      return true;
    } catch {
      return false;
    }
  }
}

export async function ensureBscNetwork(params: EnsureBscParams): Promise<{ ok: boolean; chainId: number | null; error?: string }> {
  const provider = params.provider;
  const preferredChainId = params.preferredChainId ?? bsc.id;

  if (!provider) {
    return { ok: false, chainId: null, error: 'Wallet provider not available' };
  }

  const currentChainId = await getChainId(provider);
  if (isSupportedChain(currentChainId)) {
    return { ok: true, chainId: currentChainId };
  }

  const switched = await switchToChain(provider, preferredChainId);
  if (!switched) {
    return { ok: false, chainId: currentChainId, error: 'Failed to switch chain' };
  }

  const latestChainId = await getChainId(provider);
  if (!isSupportedChain(latestChainId)) {
    return { ok: false, chainId: latestChainId, error: 'Switched chain is still unsupported' };
  }

  return { ok: true, chainId: latestChainId };
}

export async function requestWalletAccountSwitch(): Promise<boolean> {
  if (!isInjectedAvailable()) return false;
  try {
    await (window as any).ethereum.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });
    return true;
  } catch {
    return false;
  }
}

export function getTrustWalletDeepLink(): string {
  if (typeof window === 'undefined') return '';
  const url = encodeURIComponent(`${window.location.origin}${window.location.pathname}`);
  return `https://link.trustwallet.com/open_url?coin_id=20000714&url=${url}`;
}

export function getWalletAppLinks() {
  return {
    metamask: {
      android: 'https://play.google.com/store/apps/details?id=io.metamask',
      ios: 'https://apps.apple.com/app/metamask/id1438144202',
    },
    trustWallet: {
      android: 'https://play.google.com/store/apps/details?id=com.wallet.crypto.trustapp',
      ios: 'https://apps.apple.com/app/trust-crypto-bitcoin-wallet/id1288339409',
    },
  };
}

export function getChainName(chainId: number | null | undefined): string {
  if (!chainId) return 'Unknown';
  const names: Record<number, string> = {
    1: 'Ethereum',
    56: 'BNB Smart Chain',
    97: 'BSC Testnet',
    137: 'Polygon',
    43114: 'Avalanche',
    42161: 'Arbitrum',
    10: 'Optimism',
  };
  return names[chainId] || `Chain ${chainId}`;
}
```

