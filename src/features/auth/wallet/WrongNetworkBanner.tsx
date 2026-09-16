import { AlertTriangle } from "lucide-react";
import { getChainName } from "@/utils/mobileWalletConnect";

interface WrongNetworkBannerProps {
  show: boolean;
  chainId?: number | null;
}

export function WrongNetworkBanner({ show, chainId }: WrongNetworkBannerProps) {
  if (!show) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
      <AlertTriangle size={16} className="mt-0.5 text-amber-400" />
      <span>
        Ví đang kết nối trên <strong>{getChainName(chainId)}</strong>. Vui lòng chuyển sang đúng mạng để tiếp tục.
      </span>
    </div>
  );
}
