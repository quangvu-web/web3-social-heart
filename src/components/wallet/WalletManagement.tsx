import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Plus,
  RefreshCw,
  Shield,
  Star,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import metamaskLogo from "@/assets/metamask-logo.png";
import { isWalletConnectConfigured } from "@/config/web3";
import { connectWalletViaRainbowModal, isStandalonePwa, MODAL_OPEN_FAILED_HINT, PWA_RECONNECT_HINT } from "@/utils/mobileWalletConnect";
import { useWalletAuth } from "@/features/auth/wallet/useWalletAuth";

interface WalletManagementProps {
  externalWalletAddress?: string | null;
  custodialWalletAddress?: string | null;
  defaultWalletType?: "custodial" | "external" | null;
  onRefresh: () => void;
}

export const WalletManagement = ({
  externalWalletAddress,
  custodialWalletAddress,
  defaultWalletType,
  onRefresh,
}: WalletManagementProps) => {
  const { address: connectedAddress, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { linkWallet, isLinking } = useWalletAuth();

  const [isCreatingCustodial, setIsCreatingCustodial] = useState(false);
  const [isUpdatingDefault, setIsUpdatingDefault] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const shortenAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    toast.success("Đã copy địa chỉ ví");
    window.setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleConnectExternalWallet = useCallback(async () => {
    if (!isWalletConnectConfigured) {
      toast.error("WalletConnect config missing. Vui long cau hinh VITE_WALLETCONNECT_PROJECT_ID.");
      return;
    }

    if (!isConnected || !connectedAddress) {
      const opened = connectWalletViaRainbowModal(openConnectModal);
      if (!opened) {
        if (isStandalonePwa()) {
          toast.error(`Khong mo duoc vi tu PWA. ${PWA_RECONNECT_HINT}`);
        } else {
          toast.error(MODAL_OPEN_FAILED_HINT);
        }
      } else {
        toast.info("Ví đã được mở. Sau khi kết nối xong, hãy bấm lại để liên kết ví.", { duration: 4000 });
      }
      return;
    }

    try {
      await linkWallet();
      toast.success("Đã kết nối ví ngoài thành công!");
      onRefresh();
    } catch (error: any) {
      console.error("[WalletManagement] Connect error:", error);
      toast.error(error?.message || "Không thể kết nối ví");
    }
  }, [connectedAddress, isConnected, linkWallet, onRefresh, openConnectModal]);

  const handleCreateCustodialWallet = useCallback(async () => {
    setIsCreatingCustodial(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-custodial-wallet", {
        body: { chain_id: 56 },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Không thể tạo ví");
      }

      toast.success("Đã tạo ví custodial thành công!");
      onRefresh();
    } catch (error: any) {
      console.error("[WalletManagement] Create custodial error:", error);
      toast.error(error?.message || "Không thể tạo ví custodial");
    } finally {
      setIsCreatingCustodial(false);
    }
  }, [onRefresh]);

  const handleSetDefaultWallet = useCallback(
    async (type: "custodial" | "external") => {
      if (type === "external" && !externalWalletAddress) {
        toast.error("Bạn chưa kết nối ví ngoài");
        return;
      }
      if (type === "custodial" && !custodialWalletAddress) {
        toast.error("Bạn chưa có ví custodial");
        return;
      }

      setIsUpdatingDefault(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) {
          toast.error("Vui lòng đăng nhập lại");
          return;
        }

        const { error } = await supabase.from("profiles").update({ default_wallet_type: type }).eq("id", session.user.id);
        if (error) throw error;

        toast.success(`Đã đặt ${type === "custodial" ? "ví custodial" : "ví ngoài"} làm mặc định`);
        onRefresh();
      } catch (error) {
        console.error("[WalletManagement] Update default error:", error);
        toast.error("Không thể cập nhật ví mặc định");
      } finally {
        setIsUpdatingDefault(false);
      }
    },
    [custodialWalletAddress, externalWalletAddress, onRefresh],
  );

  const hasBothWallets = Boolean(externalWalletAddress && custodialWalletAddress);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={`relative overflow-hidden transition-all ${defaultWalletType === "external" ? "ring-2 ring-primary" : ""}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={metamaskLogo} alt="MetaMask" className="h-6 w-6" />
                <CardTitle className="text-lg">Ví MetaMask</CardTitle>
              </div>
              {defaultWalletType === "external" && (
                <Badge variant="default" className="gap-1">
                  <Star className="h-3 w-3" />
                  Mặc định
                </Badge>
              )}
            </div>
            <CardDescription>Ví ngoài - bạn tự quản lý khóa riêng tư</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {externalWalletAddress ? (
              <>
                <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                  <code className="flex-1 text-sm font-mono">{shortenAddress(externalWalletAddress)}</code>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyAddress(externalWalletAddress)}>
                    {copiedAddress === externalWalletAddress ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <a href={`https://bscscan.com/address/${externalWalletAddress}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <span>Bạn hoàn toàn kiểm soát ví này. Private key được lưu trong MetaMask hoặc ví ngoài của bạn.</span>
                </div>
              </>
            ) : (
              <>
                <div className="py-4 text-center">
                  <Wallet className="mx-auto mb-2 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Chưa kết nối ví ngoài</p>
                </div>

                <Button className="w-full gap-2" onClick={() => void handleConnectExternalWallet()} disabled={isLinking}>
                  {isLinking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  {isLinking ? "Đang liên kết..." : isConnected ? "Liên kết ví hiện tại" : "Kết nối MetaMask"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={`relative overflow-hidden transition-all ${defaultWalletType === "custodial" ? "ring-2 ring-primary" : ""}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-400">
                  <Shield className="h-3.5 w-3.5 text-white" />
                </div>
                <CardTitle className="text-lg">Ví F.U.</CardTitle>
              </div>
              {defaultWalletType === "custodial" && (
                <Badge variant="default" className="gap-1">
                  <Star className="h-3 w-3" />
                  Mặc định
                </Badge>
              )}
            </div>
            <CardDescription>Ví custodial - hệ thống quản lý an toàn</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {custodialWalletAddress ? (
              <>
                <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                  <code className="flex-1 text-sm font-mono">{shortenAddress(custodialWalletAddress)}</code>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyAddress(custodialWalletAddress)}>
                    {copiedAddress === custodialWalletAddress ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <a href={`https://bscscan.com/address/${custodialWalletAddress}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                  <span>Dễ sử dụng, không cần cài đặt ví. Phù hợp cho người mới bắt đầu.</span>
                </div>
              </>
            ) : (
              <>
                <div className="py-4 text-center">
                  <Shield className="mx-auto mb-2 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Chưa tạo ví custodial</p>
                </div>

                <Button className="w-full gap-2" variant="outline" onClick={() => void handleCreateCustodialWallet()} disabled={isCreatingCustodial}>
                  {isCreatingCustodial ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {isCreatingCustodial ? "Đang tạo..." : "Tạo ví F.U."}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {hasBothWallets && (
        <>
          <Separator />
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Ví mặc định</h3>
              <p className="text-xs text-muted-foreground">Chọn ví sẽ được sử dụng khi nhận thưởng và thực hiện giao dịch</p>
            </div>

            <RadioGroup
              value={defaultWalletType || "custodial"}
              onValueChange={(value) => void handleSetDefaultWallet(value as "custodial" | "external")}
              disabled={isUpdatingDefault}
              className="grid gap-3"
            >
              <div className="flex items-center space-x-3 rounded-lg border p-3 transition-colors hover:bg-accent/50">
                <RadioGroupItem value="external" id="external" />
                <Label htmlFor="external" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <img src={metamaskLogo} alt="MetaMask" className="h-5 w-5" />
                    <span className="font-medium">Ví MetaMask</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Sử dụng ví ngoài của bạn - bảo mật cao nhất</p>
                </Label>
              </div>

              <div className="flex items-center space-x-3 rounded-lg border p-3 transition-colors hover:bg-accent/50">
                <RadioGroupItem value="custodial" id="custodial" />
                <Label htmlFor="custodial" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-400">
                      <Shield className="h-3 w-3 text-white" />
                    </div>
                    <span className="font-medium">Ví F.U.</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Sử dụng ví custodial - tiện lợi, không cần MetaMask</p>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </>
      )}

      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Shield className="h-4 w-4" />
          So sánh 2 loại ví
        </h4>

        <div className="grid gap-3 text-xs">
          <div className="grid grid-cols-3 gap-2 font-medium text-muted-foreground">
            <div>Tính năng</div>
            <div className="text-center">MetaMask</div>
            <div className="text-center">Ví F.U.</div>
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-2">
            <div>Bảo mật</div>
            <div className="text-center text-green-600">★★★★★</div>
            <div className="text-center text-yellow-600">★★★★☆</div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>Dễ sử dụng</div>
            <div className="text-center text-yellow-600">★★★☆☆</div>
            <div className="text-center text-green-600">★★★★★</div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>Cần cài đặt</div>
            <div className="text-center text-red-500">Có</div>
            <div className="text-center text-green-500">Không</div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>Tự quản lý key</div>
            <div className="text-center text-green-500">Có</div>
            <div className="text-center text-muted-foreground">Hệ thống</div>
          </div>
        </div>
      </div>
    </div>
  );
};
