import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { WalletConnectButton } from "./WalletConnectButton";
import { WrongNetworkBanner } from "./WrongNetworkBanner";
import { useWalletAuth, type WalletLoginResult } from "./useWalletAuth";
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
import { TelegramOtpChallenge } from "@/modules/auth/components/TelegramOtpChallenge";

interface WalletLoginPanelProps {
  onSuccess?: (userId: string, isNewUser: boolean, needsEmailVerification: boolean) => void;
}

const STEPS = [
  { key: "connect", label: "Kết nối" },
  { key: "network", label: "Mạng" },
  { key: "sign", label: "Ký" },
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
                {isDone ? "✓" : index + 1}
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
  const [pendingTelegram, setPendingTelegram] = useState<{
    challengeId: string;
    userId: string;
    isNewUser: boolean;
    needsEmailVerification: boolean;
  } | null>(null);
  const isMobile = isMobileDevice();
  const inMetaMaskMobile = isMetaMaskMobileBrowser();
  const inTrustWalletMobile = isTrustWalletMobileBrowser();
  const inInjectedMobileBrowser = auth.authMode === "injected_mobile_browser";

  const handleWalletResult = (result: WalletLoginResult) => {
    if (result.telegramChallenge) {
      setPendingTelegram({
        challengeId: result.telegramChallenge.challengeId,
        userId: result.user_id,
        isNewUser: result.isNewUser,
        needsEmailVerification: result.needsEmailVerification,
      });
      toast.success("Mã Telegram đã được gửi.");
      return;
    }
    toast.success("Đăng nhập ví thành công.");
    onSuccess?.(result.user_id, result.isNewUser, result.needsEmailVerification);
  };

  const shortAddr = auth.connectedAddress
    ? `${auth.connectedAddress.slice(0, 6)}...${auth.connectedAddress.slice(-4)}`
    : "";

  const helperText = useMemo(() => {
    if (auth.phase === "connecting") {
      return inMetaMaskMobile ? "Bạn đang ở trong MetaMask. Hãy kết nối ví để tiếp tục." : "Đang kết nối ví...";
    }
    if (auth.phase === "signing") {
      return auth.wasBackgroundedDuringSign
        ? "Vui lòng xác nhận chữ ký trong ví của bạn."
        : "Đang mở ví để xác nhận...";
    }
    if (auth.phase === "signing_pending_wallet" || auth.pendingRequestDetected) {
      return "Yêu cầu ký đang chờ xử lý trong MetaMask. Vui lòng mở lại cửa sổ xác nhận trong ví để tiếp tục.";
    }
    if (auth.phase === "verifying") {
      return "Đang xác thực chữ ký và tạo phiên đăng nhập...";
    }
    return null;
  }, [auth.pendingRequestDetected, auth.phase, auth.wasBackgroundedDuringSign, inMetaMaskMobile]);

  const handleConnectInjected = async () => {
    try {
      await auth.connectWallet();
      toast.success(inMetaMaskMobile ? "Đã kết nối MetaMask." : "Đã kết nối ví.");
    } catch (error: any) {
      toast.error(error?.message || "Không thể kết nối ví.");
    }
  };

  const handleLogin = async () => {
    try {
      const result = await auth.startWalletLoginFlow();
      handleWalletResult(result);
    } catch (error: any) {
      const message = error?.message || auth.error?.message || "Không thể đăng nhập bằng ví.";
      if (auth.phase === "signing_pending_wallet" || auth.pendingRequestDetected) {
        toast.warning("Yêu cầu ký đang chờ xử lý trong MetaMask. Vui lòng mở lại cửa sổ xác nhận trong ví để tiếp tục.");
        return;
      }
      toast.error(message);
    }
  };

  const handleRetry = async () => {
    try {
      const result = await auth.retryCurrentStep();
      if (result) {
        handleWalletResult(result);
      }
    } catch (error: any) {
      toast.error(error?.message || auth.error?.message || "Không thể thử lại.");
    }
  };

  const handleResumeCheck = async () => {
    try {
      const result = await auth.resumePendingFlowCheck();
      if (result) {
        handleWalletResult(result);
      } else {
        toast.info("Vui lòng xác nhận chữ ký trong ví của bạn.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Không thể kiểm tra lại trạng thái ký.");
    }
  };

  const handleSwitchWallet = async () => {
    try {
      const result = await auth.switchWalletAccount();
      if (result.cancelled) {
        toast.info("Bạn đã hủy chọn ví.");
        return;
      }
      if (result.switched) {
        toast.success("Đã chuyển sang ví mới.");
        return;
      }
      if (result.fallbackUsed) {
        toast("Vui lòng chọn tài khoản khác trong ví rồi quay lại ứng dụng.", { duration: 6000 });
        return;
      }
      toast.info("Ví hiện tại vẫn được giữ nguyên.");
    } catch (error: any) {
      toast.error(error?.message || "Không thể đổi ví.");
    }
  };

  if (pendingTelegram) {
    return (
      <TelegramOtpChallenge
        challengeId={pendingTelegram.challengeId}
        userId={pendingTelegram.userId}
        isNewUser={pendingTelegram.isNewUser}
        onVerified={(userId, isNewUser) => {
          const needsEmail = pendingTelegram.needsEmailVerification;
          setPendingTelegram(null);
          onSuccess?.(userId, isNewUser, needsEmail);
        }}
        onCancel={() => setPendingTelegram(null)}
      />
    );
  }



  if (auth.phase === "idle" || auth.phase === "connecting") {
    if (inInjectedMobileBrowser) {
      return (
        <div className="space-y-4">
          <StepProgressBar state={auth.phase} />
          <p className="text-center text-sm text-muted-foreground">
            {inMetaMaskMobile
              ? "Bạn đang ở trong MetaMask. Hãy kết nối ví để tiếp tục."
              : inTrustWalletMobile
                ? "Bạn đang ở trong Trust Wallet. Hãy kết nối ví để tiếp tục."
                : "Bạn đang ở trong trình duyệt ví. Hãy kết nối ví để tiếp tục."}
          </p>

          <Button className="w-full" onClick={() => void handleConnectInjected()} disabled={auth.phase === "connecting"}>
            {auth.phase === "connecting" ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={16} />
                Đang kết nối ví...
              </>
            ) : (
              <>
                <Wallet className="mr-2" size={16} />
                {inMetaMaskMobile ? "Kết nối MetaMask" : "Kết nối ví"}
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Không cần mở lại ứng dụng ví. Bạn đã ở đúng trong trình duyệt dApp của ví.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <StepProgressBar state={auth.phase} />

        {isMobile ? (
          <>
            <p className="text-center text-sm text-muted-foreground">Mở ứng dụng ví hoặc quét QR để kết nối</p>

            <a
              href={getMetaMaskDeepLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Wallet size={16} />
              Mở trong MetaMask
              <ExternalLink size={14} />
            </a>

            <a
              href={getTrustWalletDeepLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              <Shield size={16} />
              Mở trong Trust Wallet
              <ExternalLink size={14} />
            </a>

            <WalletConnectButton className="w-full" label="Kết nối qua WalletConnect" isLoading={auth.phase === "connecting"} onConnectStart={() => void auth.connectWallet()} />

            <div className="border-t border-border/50 pt-3">
              <p className="mb-2 text-center text-xs text-muted-foreground">Chưa có ví? Tải ứng dụng ví</p>
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
            <WalletConnectButton className="w-full" label="Kết nối ví / Connect Wallet" isLoading={auth.phase === "connecting"} onConnectStart={() => void auth.connectWallet()} />
            <p className="text-center text-xs text-muted-foreground">MetaMask, Trust Wallet, WalletConnect và các ví khác</p>
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
              Đang chuyển mạng...
            </>
          ) : (
            "Chuyển sang BNB Smart Chain"
          )}
        </Button>

        <Button variant="outline" className="w-full" onClick={() => void handleSwitchWallet()} disabled={auth.isSwitchingWallet}>
          <RefreshCw size={14} />
          Đổi ví khác
        </Button>

        <button type="button" onClick={() => void auth.disconnectWallet()} className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
          Ngắt kết nối
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
              ? "MetaMask vẫn đang giữ yêu cầu ký trước đó. Đừng bấm ký nhiều lần. Hãy quay lại cửa sổ xác nhận trong ví."
              : "Yêu cầu ký này không tốn gas. Nếu bạn vừa quay lại từ ví, hãy dùng nút kiểm tra lại thay vì tạo yêu cầu ký mới."}
          </p>
        </div>

        {isMobile && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Hỗ trợ cho trình duyệt ví trên điện thoại</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <a
                href={getMetaMaskDeepLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium"
              >
                <Wallet size={14} />
                Mở lại MetaMask
              </a>
              {!inMetaMaskMobile && (
                <a
                  href={getTrustWalletDeepLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium"
                >
                  <Shield size={14} />
                  Mở lại Trust Wallet
                </a>
              )}
            </div>
            <Button variant="outline" className="w-full" onClick={() => void handleResumeCheck()}>
              Tôi đã xác nhận
            </Button>
            <Button variant="outline" className="w-full" onClick={() => void handleSwitchWallet()} disabled={auth.isSwitchingWallet}>
              Đổi ví khác
            </Button>
            <button type="button" onClick={() => void auth.disconnectWallet()} className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
              Ngắt kết nối
            </button>
          </div>
        )}

        <button type="button" onClick={() => auth.resetWalletAuthFlow("retry")} className="flex w-full items-center justify-center gap-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft size={12} />
          Quay lại
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
          <p className="text-sm font-medium text-foreground">Đăng nhập ví thành công.</p>
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
          <p className="text-sm font-medium text-foreground">Xác thực thất bại</p>
          {auth.error?.message && <p className="max-w-[300px] text-center text-xs text-muted-foreground">{auth.error.message}</p>}
        </div>

        {auth.pendingRequestDetected ? (
          <>
            <Button className="w-full" variant="outline" onClick={() => void handleResumeCheck()}>
              Kiểm tra lại
            </Button>
            <Button variant="outline" className="w-full" onClick={() => void handleSwitchWallet()} disabled={auth.isSwitchingWallet}>
              Đổi ví khác
            </Button>
          </>
        ) : (
          <Button className="w-full" onClick={() => void handleRetry()} disabled={auth.isSigning || auth.isVerifying}>
            Thử lại
          </Button>
        )}

        <button type="button" onClick={() => void auth.disconnectWallet()} className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
          Ngắt kết nối
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
          <span className="text-sm font-medium text-foreground">Đã kết nối ví</span>
        </div>

        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
          <Wallet size={16} className="shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-foreground">{shortAddr}</span>
          <CheckCircle2 size={14} className="ml-auto shrink-0 text-emerald-400" />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Mạng:</span>
          <span className="font-medium text-foreground">BNB Smart Chain</span>
        </div>
      </div>

      <Button className="w-full" onClick={() => void handleLogin()} disabled={auth.isSigning || auth.isVerifying}>
        {auth.isSigning || auth.isVerifying ? "Đang xử lý..." : "Ký và đăng nhập"}
      </Button>

      <Button variant="outline" className="w-full" onClick={() => void handleSwitchWallet()} disabled={auth.isSwitchingWallet}>
        <RefreshCw size={14} />
        Đổi ví khác
      </Button>

      <button type="button" onClick={() => void auth.disconnectWallet()} className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
        Ngắt kết nối
      </button>
    </div>
  );
}
