import { Button } from "@/components/ui/button";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  connectWalletViaRainbowModal,
  isStandalonePwa,
  MODAL_OPEN_FAILED_HINT,
  PWA_RECONNECT_HINT,
} from "@/utils/mobileWalletConnect";

interface WalletConnectButtonProps {
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  label?: string;
  onConnectStart?: () => void;
}

export function WalletConnectButton({
  disabled,
  isLoading,
  className,
  label = "Connect wallet",
  onConnectStart,
}: WalletConnectButtonProps) {
  const { openConnectModal } = useConnectModal();

  const handleConnect = () => {
    if (disabled || isLoading) return;

    const opened = connectWalletViaRainbowModal(openConnectModal);
    if (opened) {
      onConnectStart?.();
      return;
    }

    if (isStandalonePwa()) {
      toast.error(`Cannot open wallet modal in PWA mode. ${PWA_RECONNECT_HINT}`);
      return;
    }

    toast.error(MODAL_OPEN_FAILED_HINT);
  };

  return (
    <Button
      type="button"
      onClick={handleConnect}
      disabled={disabled || isLoading}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 animate-spin" size={16} />
          Connecting...
        </>
      ) : (
        <>
          <Wallet className="mr-2" size={16} />
          {label}
        </>
      )}
    </Button>
  );
}
