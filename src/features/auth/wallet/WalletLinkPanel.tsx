import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useWalletAuth } from "./useWalletAuth";
import { WalletConnectButton } from "./WalletConnectButton";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletLinkPanel() {
  const {
    sessionUserId,
    linkedWallets,
    isLinking,
    isConnected,
    linkWallet,
    unlinkWallet,
    setPrimaryWallet,
  } = useWalletAuth();

  const sortedWallets = useMemo(
    () =>
      [...linkedWallets].sort((a, b) => {
        if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
        const aTs = new Date(a.verified_at ?? a.created_at).getTime();
        const bTs = new Date(b.verified_at ?? b.created_at).getTime();
        return bTs - aTs;
      }),
    [linkedWallets],
  );

  if (!sessionUserId) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Please log in (OTP/Google/Password) before linking wallet.
      </p>
    );
  }

  const onLink = async () => {
    try {
      const wallet = await linkWallet();
      toast.success(`Wallet linked successfully: ${shortAddress(wallet.address)}`);
    } catch (error: any) {
      toast.error(error?.message || "Unable to link wallet");
    }
  };

  const onUnlink = async (walletId: string, address: string) => {
    const confirmed = window.confirm(
      `Re-auth confirmation required. Unlink ${shortAddress(address)} from your account?`,
    );
    if (!confirmed) return;

    try {
      await unlinkWallet(walletId);
      toast.success("Wallet unlinked");
    } catch (error: any) {
      toast.error(error?.message || "Unable to unlink wallet");
    }
  };

  const onSetPrimary = async (walletId: string) => {
    try {
      await setPrimaryWallet(walletId);
      toast.success("Primary wallet updated");
    } catch (error: any) {
      toast.error(error?.message || "Unable to update primary wallet");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <WalletConnectButton
          className="flex-1"
          label={isConnected ? "Wallet connected" : "Connect wallet"}
        />
        <Button className="flex-1" onClick={onLink} disabled={isLinking}>
          {isLinking ? "Linking..." : "Link wallet"}
        </Button>
      </div>

      <div className="space-y-2">
        {sortedWallets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No linked wallets yet.</p>
        ) : (
          sortedWallets.map((wallet) => (
            <div key={wallet.id} className="rounded-lg border p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-sm truncate">{wallet.address}</p>
                <p className="text-xs text-muted-foreground">
                  {wallet.chain_id ? `Chain ${wallet.chain_id}` : "No chain"}
                  {wallet.is_primary ? " • Primary" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={wallet.is_primary}
                  onClick={() => onSetPrimary(wallet.id)}
                >
                  Set primary
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onUnlink(wallet.id, wallet.address)}
                >
                  Unlink
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
