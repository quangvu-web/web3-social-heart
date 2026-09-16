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
        `Ð? liên k?t ví ${shortAddress(wallet.address)}${typeof wallet.chain_id === "number" ? ` (chain ${wallet.chain_id})` : ""}`,
      );
    } catch (error: any) {
      toast.error(error?.message || "Không th? liên k?t ví.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (walletId: string, address: string) => {
    const ok = window.confirm(`H?y liên k?t ví ${shortAddress(address)}?`);
    if (!ok) return;

    setUnlinkingId(walletId);
    try {
      await unlinkWallet({ walletId });
      toast.success("Ð? h?y liên k?t ví.");
    } catch (error: any) {
      toast.error(error?.message || "Không th? h?y liên k?t ví.");
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
        <h3 className="text-lg font-bold text-foreground">Liên k?t ví Web3</h3>
        <p className="text-sm text-muted-foreground">Liên k?t nhi?u ví vào cùng m?t tài kho?n FUN Profile.</p>
      </div>

      <Button
        onClick={handleLink}
        disabled={isLinking}
        className="w-full h-12 text-base font-semibold rounded-full"
        style={{
          background: "linear-gradient(135deg, #166534 0%, #15803d 50%, #166534 100%)",
        }}
      >
        {isLinking ? (
          <>
            <Loader2 className="animate-spin mr-2" size={18} />
            Ðang liên k?t...
          </>
        ) : (
          <>
            <Wallet className="mr-2" size={18} />
            K?t n?i & liên k?t ví
          </>
        )}
      </Button>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Ví ð? liên k?t</p>
        {sortedWallets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chýa có ví nào ðý?c liên k?t.</p>
        ) : (
          <div className="space-y-2">
            {sortedWallets.map((wallet) => {
              const isUnlinking = unlinkingId === wallet.id;
              return (
                <div
                  key={wallet.id}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-slate-800 truncate">{wallet.address}</p>
                    <p className="text-xs text-muted-foreground">
                      {typeof wallet.chain_id === "number" ? `Chain ${wallet.chain_id}` : "Chain chýa xác ð?nh"}
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
