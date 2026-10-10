import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useUnifiedAuth } from "@/modules/auth/hooks/useUnifiedAuth";

interface WalletLoginContentProps {
  onSuccess: (userId: string, isNewUser: boolean) => void;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export const WalletLoginContent = ({ onSuccess: _onSuccess }: WalletLoginContentProps) => {
  const { session, wallets, linkWallet, unlinkWallet } = useUnifiedAuth();
  const [isLinking, setIsLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const sortedWallets = useMemo(
    () =>
      [...wallets].sort((a, b) => {
        const aTs = new Date(a.verified_at ?? a.created_at).getTime();
        const bTs = new Date(b.verified_at ?? b.created_at).getTime();
        return bTs - aTs;
      }),
    [wallets],
  );

  const handleLink = async () => {
    setIsLinking(true);
    try {
      const wallet = await linkWallet();
      toast.success(
        `Đã liên kết ví ${shortAddress(wallet.address)}${typeof wallet.chain_id === "number" ? ` (chain ${wallet.chain_id})` : ""}`,
      );
    } catch (error: any) {
      toast.error(error?.message || "Không thể liên kết ví.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (walletId: string, address: string) => {
    const ok = window.confirm(`Hủy liên kết ví ${shortAddress(address)}?`);
    if (!ok) return;

    setUnlinkingId(walletId);
    try {
      await unlinkWallet({ walletId });
      toast.success("Đã hủy liên kết ví.");
    } catch (error: any) {
      toast.error(error?.message || "Không thể hủy liên kết ví.");
    } finally {
      setUnlinkingId(null);
    }
  };

  if (!session) {
    return (
      <div className="space-y-4 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted">
          <Wallet className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Please log in (OTP/Google/Password) before linking wallet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h3 className="text-lg font-bold text-foreground">Liên kết ví Web3</h3>
        <p className="text-sm text-muted-foreground">Liên kết nhiều ví vào cùng một tài khoản FUN Profile.</p>
      </div>

      <Button
        onClick={handleLink}
        disabled={isLinking}
        className="w-full h-12 text-base font-semibold rounded-full"
        style={{
          background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-hover)) 50%, hsl(var(--primary)) 100%)",
        }}
      >
        {isLinking ? (
          <>
            <Loader2 className="animate-spin mr-2" size={18} />
            Đang liên kết...
          </>
        ) : (
          <>
            <Wallet className="mr-2" size={18} />
            Kết nối & liên kết ví
          </>
        )}
      </Button>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Ví đã liên kết</p>
        {sortedWallets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có ví nào được liên kết.</p>
        ) : (
          <div className="space-y-2">
            {sortedWallets.map((wallet) => {
              const isUnlinking = unlinkingId === wallet.id;
              return (
                <div
                  key={wallet.id}
                  className="rounded-lg border border-slate-200 bg-card px-3 py-2 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-slate-800 truncate">{wallet.address}</p>
                    <p className="text-xs text-muted-foreground">
                      {typeof wallet.chain_id === "number" ? `Chain ${wallet.chain_id}` : "Chain chưa xác định"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isUnlinking}
                    onClick={() => handleUnlink(wallet.id, wallet.address)}
                  >
                    {isUnlinking ? <Loader2 className="animate-spin" size={14} /> : "Unlink"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
