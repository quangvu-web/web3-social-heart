import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { bsc } from 'wagmi/chains';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Gift, Wallet, Info, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { ReceiveTab } from './ReceiveTab';
import { SendTab } from './SendTab';
import { SwapTab } from './SwapTab';
import { BuyTab } from './BuyTab';
import { ClaimRewardDialog } from './ClaimRewardDialog';
import { WalletCard } from './WalletCard';
import { RewardBreakdown, RewardStats } from './RewardBreakdown';
import { RewardFormulaCard } from './RewardFormulaCard';
import { GiftHistoryPanel } from './GiftHistoryPanel';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import type { SendToken } from '@/modules/wallet/services/sendAsset';
import bnbLogo from '@/assets/tokens/bnb-logo.webp';
import { isWalletConnectConfigured } from '@/config/web3';
import { WalletNetworkSelector, getInitialNetwork, type WalletViewNetwork } from './WalletNetworkSelector';
import { BitcoinWalletPanel } from './BitcoinWalletPanel';
import {
  connectWalletViaRainbowModal,
  ensureBscNetwork,
  formatNetworkResolveDebug,
  getChainId,
  isStandalonePwa,
  isSupportedChain,
  MODAL_OPEN_FAILED_HINT,
  normalizeChainId,
  PWA_RECONNECT_HINT,
  requestWalletAccountSwitch,
  resolveWalletProvider,
  SUPPORTED_CHAIN_IDS,
} from '@/utils/mobileWalletConnect';
import { useUnifiedAuth } from '@/modules/auth/hooks/useUnifiedAuth';

interface Profile {
  username: string;
  avatar_url: string | null;
  full_name: string | null;
  trust_level: number;
  reward_status?: string;
  admin_notes?: string | null;
}

// Key to track if user explicitly disconnected
const WALLET_DISCONNECTED_KEY = 'fun_profile_wallet_disconnected';

const WalletCenterContainer = () => {
  const { address, isConnected, connector, chainId: wagmiChainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();
  const { user, wallets, linkWallet, unlinkWallet, refresh } = useUnifiedAuth();
  const queryClient = useQueryClient();
  
  const currentUserId = user?.id ?? null;

  const [activeNetwork, setActiveNetwork] = useState<WalletViewNetwork>(getInitialNetwork);

  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [showBuy, setShowBuy] = useState(false);
  const [sendInitialToken, setSendInitialToken] = useState<SendToken | undefined>(undefined);
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  
  // Copy state for external wallet
  const [copiedExternal, setCopiedExternal] = useState(false);
  
  // Linking/Unlinking wallet states
  const [isLinkingWallet, setIsLinkingWallet] = useState(false);
  const [isUnlinkingWallet, setIsUnlinkingWallet] = useState(false);
  
  // Track if we should show disconnected UI
  const [showDisconnectedUI, setShowDisconnectedUI] = useState(() => {
    return localStorage.getItem(WALLET_DISCONNECTED_KEY) === 'true';
  });
  const [networkChainId, setNetworkChainId] = useState<number | null>(null);
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [isOpeningConnect, setIsOpeningConnect] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const primaryLinkedWallet = wallets[0] ?? null;
  const primaryLinkedWalletAddress = primaryLinkedWallet?.address ?? null;
  const pwaMode = useMemo(() => isStandalonePwa(), []);
  const lastDevNetworkToastAtRef = useRef(0);
  const lastUserNetworkToastAtRef = useRef(0);

  // === React Query: Profile ===
  const profileQuery = useQuery({
    queryKey: ['wallet-profile', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url, full_name, trust_level, reward_status, admin_notes')
        .eq('id', currentUserId)
        .single();
      return (data as Profile) ?? null;
    },
    enabled: !!currentUserId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
  const profile = profileQuery.data ?? null;
  const isTrustBlocked = (profile?.trust_level ?? 0) < 1;

  // === React Query: Claimable Reward ===
  const rewardQuery = useQuery({
    queryKey: ['wallet-rewards', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return null;

      const { data: rewardsData, error: rpcError } = await supabase.rpc('get_user_rewards_v2', {
        limit_count: 10000
      });

      if (rpcError) {
        console.error('[WalletCenter] RPC error:', rpcError);
        return null;
      }

      const userData = rewardsData?.find((u: any) => u.id === currentUserId);
      
      if (userData) {
        const stats: RewardStats = {
          posts_count: Number(userData.posts_count) || 0,
          reactions_on_posts: Number(userData.reactions_on_posts) || 0,
          comments_count: Number(userData.comments_count) || 0,
          shares_count: Number(userData.shares_count) || 0,
          friends_count: Number(userData.friends_count) || 0,
          livestreams_count: Number(userData.livestreams_count) || 0,
          total_reward: Number(userData.total_reward) || 0,
          today_reward: Number(userData.today_reward) || 0,
        };

        const totalReward = Number(userData.total_reward) || 0;

        const { data: claims } = await supabase
          .from('reward_claims')
          .select('amount')
          .eq('user_id', currentUserId);
          
        const claimed = claims?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
        return { stats, claimable: Math.max(0, totalReward - claimed), claimed };
      }

      return {
        stats: {
          posts_count: 0, reactions_on_posts: 0, comments_count: 0, shares_count: 0,
          friends_count: 0, livestreams_count: 0, total_reward: 50000, today_reward: 0,
        } as RewardStats,
        claimable: 50000,
        claimed: 0,
      };
    },
    enabled: !!currentUserId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  const rewardStats = rewardQuery.data?.stats ?? null;
  const claimableReward = rewardQuery.data?.claimable ?? 0;
  const claimedAmount = rewardQuery.data?.claimed ?? 0;
  const isRewardLoading = rewardQuery.isLoading;

  // === React Query: Cooldown ===
  const cooldownQuery = useQuery({
    queryKey: ['wallet-cooldown', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return null;
      
      const { count } = await supabase
        .from('user_wallets')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUserId);
      
      if (!count || count === 0) return null;
      
      const { data: prof } = await supabase
        .from('profiles')
        .select('last_wallet_changed_at')
        .eq('id', currentUserId)
        .single();
      
      if (!prof?.last_wallet_changed_at) return null;
      
      const changedAt = new Date(prof.last_wallet_changed_at).getTime();
      const now = Date.now();
      const daysPassed = (now - changedAt) / (1000 * 60 * 60 * 24);
      const daysLeft = Math.ceil(30 - daysPassed);
      return daysLeft > 0 ? daysLeft : null;
    },
    enabled: !!currentUserId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
  const cooldownDaysLeft = cooldownQuery.data ?? null;

  // Detect connected wallet type
  const connectedWalletType = useMemo(() => {
    if (!connector) return null;
    const name = connector.name.toLowerCase();
    if (name.includes('metamask')) return 'metamask';
    if (name.includes('bitget')) return 'bitget';
    if (name.includes('trust')) return 'trust';
    if (name.includes('fun')) return 'fun';
    return 'other';
  }, [connector]);

  // Get wallet display name
  const getWalletDisplayName = useCallback(() => {
    if (connector?.name) return connector.name;
    switch (connectedWalletType) {
      case 'metamask': return 'MetaMask';
      case 'bitget': return 'Bitget Wallet';
      case 'trust': return 'Trust Wallet';
      case 'fun': return 'FUN Wallet';
      default: return 'External Wallet';
    }
  }, [connector, connectedWalletType]);

  // Use token balances for external wallet
  const externalAddress = (address || primaryLinkedWalletAddress) as `0x${string}` | undefined;
  const { 
    tokens: externalTokens, 
    totalUsdValue: externalTotalValue, 
    isLoading: isExternalLoading, 
    refetch: refetchExternal 
  } = useTokenBalances({ customAddress: externalAddress });

  // Get CAMLY price for claimable calculation
  const camlyPrice = useMemo(() => {
    const camlyToken = externalTokens.find(t => t.symbol === 'CAMLY');
    return camlyToken?.price || 0;
  }, [externalTokens]);

  // On mount, disconnect wagmi if user explicitly disconnected before
  useEffect(() => {
    const wasDisconnected = localStorage.getItem(WALLET_DISCONNECTED_KEY) === 'true';
    if (wasDisconnected && showDisconnectedUI && isConnected) {
      disconnect();
    }
  }, [isConnected, disconnect, showDisconnectedUI]);

  // When wallet becomes connected, clear disconnected flag
  useEffect(() => {
    if (!isConnected) return;
    localStorage.removeItem(WALLET_DISCONNECTED_KEY);
    setShowDisconnectedUI(false);
    if (import.meta.env.DEV) {
      console.debug('[WalletCenter][event] connect_returned', {
        connector: connector?.name,
        pwaMode,
      });
    }
  }, [connector?.name, isConnected, pwaMode]);

  const showDevNetworkResolveToast = useCallback((reason: string) => {
    if (!import.meta.env.DEV) return;
    const now = Date.now();
    if (now - lastDevNetworkToastAtRef.current < 10000) return;
    lastDevNetworkToastAtRef.current = now;
    toast.warning(
      formatNetworkResolveDebug({
        connectorName: connector?.name,
        isPwa: pwaMode,
        reason,
      })
    );
  }, [connector, pwaMode]);

  const syncNetworkState = useCallback(async (): Promise<{ chainId: number | null; error: string | null }> => {
    if (!isConnected) {
      setNetworkChainId(null);
      setNetworkError(null);
      setIsCheckingNetwork(false);
      return { chainId: null, error: null };
    }

    if (wagmiChainId) {
      setNetworkChainId(wagmiChainId);
      setNetworkError(null);
      setIsCheckingNetwork(false);
      return { chainId: wagmiChainId, error: null };
    }

    setIsCheckingNetwork(true);
    try {
      const provider = await resolveWalletProvider(connector);
      if (!provider) {
        const error = 'Wallet provider unavailable';
        setNetworkChainId(null);
        setNetworkError(error);
        showDevNetworkResolveToast(error);
        return { chainId: null, error };
      }

      const chainIdFromRpc = await getChainId(provider);
      if (!chainIdFromRpc) {
        const error = 'Cannot detect active chain';
        setNetworkChainId(null);
        setNetworkError(error);
        showDevNetworkResolveToast(error);
        return { chainId: null, error };
      }

      setNetworkChainId(chainIdFromRpc);
      setNetworkError(null);

      if (import.meta.env.DEV) {
        console.debug('[WalletCenter] Network check', {
          connector: connector?.name,
          chainIdHex: chainIdFromRpc ? `0x${chainIdFromRpc.toString(16)}` : null,
          chainIdNumber: chainIdFromRpc,
          supportedChains: SUPPORTED_CHAIN_IDS,
        });
      }

      return { chainId: chainIdFromRpc, error: null };
    } catch (error) {
      console.error('[WalletCenter] syncNetworkState error:', error);
      setNetworkError('Cannot detect active chain');
      setNetworkChainId(null);
      showDevNetworkResolveToast('sync-exception');
      return { chainId: null, error: 'Cannot detect active chain' };
    } finally {
      setIsCheckingNetwork(false);
    }
  }, [connector, isConnected, wagmiChainId, showDevNetworkResolveToast]);

  useEffect(() => {
    void syncNetworkState();
  }, [syncNetworkState, isConnected, address]);

  // Sync wagmi chainId reactively
  useEffect(() => {
    if (wagmiChainId) {
      setNetworkChainId(wagmiChainId);
      setNetworkError(null);
    }
  }, [wagmiChainId]);

  useEffect(() => {
    if (!isConnected) return;

    let cleanup = () => {};

    const setupListeners = async () => {
      const provider = await resolveWalletProvider(connector);
      if (!provider?.on) return;

      const handleChainChanged = (nextChain: unknown) => {
        const normalized = normalizeChainId(nextChain);
        setNetworkChainId(normalized);
        setNetworkError(normalized ? null : 'Cannot detect active chain');
        if (!normalized) {
          showDevNetworkResolveToast('chainChanged-unresolved');
        }
        refetchExternal();

        if (import.meta.env.DEV) {
          console.debug('[WalletCenter] chainChanged', {
            connector: connector?.name,
            chainIdRaw: nextChain,
            chainIdNumber: normalized,
            supportedChains: SUPPORTED_CHAIN_IDS,
          });
        }
      };

      const handleAccountsChanged = () => {
        void syncNetworkState();
        refetchExternal();
      };

      provider.on('chainChanged', handleChainChanged);
      provider.on('accountsChanged', handleAccountsChanged);

      cleanup = () => {
        provider.removeListener?.('chainChanged', handleChainChanged);
        provider.removeListener?.('accountsChanged', handleAccountsChanged);
      };
    };

    setupListeners();

    return () => cleanup();
  }, [connector, isConnected, refetchExternal, showDevNetworkResolveToast, syncNetworkState]);

  const networkReady = isSupportedChain(networkChainId);
  const hasNetworkResolveIssue = Boolean(
    isConnected &&
      !isCheckingNetwork &&
      !networkChainId &&
      networkError
  );
  const isReadyConnected = Boolean(isConnected && !isCheckingNetwork && !networkError);
  const isWrongNetwork = Boolean(
    isConnected &&
      !isCheckingNetwork &&
      !hasNetworkResolveIssue &&
      networkChainId !== null &&
      !networkReady
  );

  const isCooldownActive = cooldownDaysLeft !== null && cooldownDaysLeft > 0;

  const handleConnect = useCallback(() => {
    if (import.meta.env.DEV) {
      console.debug('[WalletCenter][event] connect_clicked', {
        connector: connector?.name,
        isConnected,
        isReadyConnected,
        pwaMode,
      });
    }

    if (isOpeningConnect) return;

    if (!isWalletConnectConfigured) {
      toast.error('WalletConnect chua duoc cau hinh. Vui long lien he quan tri vien.');
      return;
    }

    setIsOpeningConnect(true);
    setShowDisconnectedUI(false);
    localStorage.removeItem(WALLET_DISCONNECTED_KEY);

    const opened = connectWalletViaRainbowModal(openConnectModal);
    if (opened) {
      if (import.meta.env.DEV) {
        console.debug('[WalletCenter][event] connect_modal_opened', {
          connector: connector?.name,
          pwaMode,
        });
      }
      window.setTimeout(() => setIsOpeningConnect(false), 1200);
      return;
    }

    if (pwaMode) {
      toast.error(`Khong mo duoc modal tu PWA. ${PWA_RECONNECT_HINT}`);
      setIsOpeningConnect(false);
      return;
    }

    toast.error(MODAL_OPEN_FAILED_HINT);
    setIsOpeningConnect(false);
  }, [connector?.name, isConnected, isOpeningConnect, isReadyConnected, openConnectModal, pwaMode]);

  const handleSwitchAccount = useCallback(async () => {
    const switched = await requestWalletAccountSwitch();
    if (switched) {
      toast.success('Da chuyen tai khoan thanh cong!');
      refetchExternal();
      return;
    }
    toast.info('Hay doi tai khoan trong vi roi reconnect lai.');
  }, [refetchExternal]);

  const handleDisconnect = useCallback(() => {
    if (isDisconnecting) return;
    setIsDisconnecting(true);

    if (import.meta.env.DEV) {
      console.debug('[WalletCenter][event] disconnect_clicked', {
        connector: connector?.name,
        isConnected,
      });
    }

    localStorage.setItem(WALLET_DISCONNECTED_KEY, 'true');
    setShowDisconnectedUI(true);
    disconnect();
    toast.success('Da ngat ket noi vi');

    window.setTimeout(() => setIsDisconnecting(false), 600);
  }, [connector?.name, disconnect, isConnected, isDisconnecting]);

  const handleSwitchNetwork = useCallback(async () => {
    if (isSwitchingNetwork) return;
    setIsSwitchingNetwork(true);

    if (import.meta.env.DEV) {
      console.debug('[WalletCenter][event] switch_network_clicked', {
        connector: connector?.name,
        networkChainId,
      });
    }

    const provider = await resolveWalletProvider(connector);
    const result = await Promise.race([
      ensureBscNetwork({ provider, preferredChainId: bsc.id }),
      new Promise((resolve) =>
        setTimeout(() => resolve({ ok: false, chainId: null, error: 'Switch network timeout. Vui long thu lai.' }), 15000)
      ),
    ]) as { ok: boolean; chainId: number | null; error?: string };

    if (result.ok) {
      await syncNetworkState();
      refetchExternal();
      toast.success('Da chuyen sang BNB Smart Chain');
      setIsSwitchingNetwork(false);
      return;
    }

    toast.error(result.error || `Khong the chuyen network. ${PWA_RECONNECT_HINT}`);
    setIsSwitchingNetwork(false);
  }, [connector, isSwitchingNetwork, networkChainId, refetchExternal, syncNetworkState]);

  const retryNetworkCheck = useCallback(async () => {
    const result = await syncNetworkState();
    refetchExternal();
    if (!result.error) return;

    const now = Date.now();
    if (now - lastUserNetworkToastAtRef.current < 10000) return;
    lastUserNetworkToastAtRef.current = now;

    if (pwaMode) {
      toast.error(`Khong the xac dinh mang. ${PWA_RECONNECT_HINT}`);
      return;
    }

    toast.error('Khong the xac dinh mang. Thu Refresh hoac reconnect wallet.');
  }, [pwaMode, refetchExternal, syncNetworkState]);

  const handleOpenSend = useCallback((token?: SendToken) => {
    setSendInitialToken(token);
    setShowSend(true);
  }, []);

  const handleSendDialogChange = useCallback((nextOpen: boolean) => {
    setShowSend(nextOpen);
    if (!nextOpen) {
      setSendInitialToken(undefined);
    }
  }, []);

  // Link wallet to profile
  const linkWalletToProfile = useCallback(async () => {
    setIsLinkingWallet(true);

    try {
      await linkWallet();
      await refresh();
      toast.success(`${getWalletDisplayName()} linked successfully!`);
    } catch (err: any) {
      console.error('[WalletCenter] Link wallet error:', err);
      toast.error(err?.message || 'Unable to link wallet');
    } finally {
      setIsLinkingWallet(false);
    }
  }, [getWalletDisplayName, linkWallet, refresh]);

  // Unlink external wallet
  const unlinkWalletFromProfile = useCallback(async () => {
    if (!primaryLinkedWallet) {
      toast.error('No linked wallet to unlink');
      return;
    }

    if (isCooldownActive) {
      toast.error(`Bạn cần chờ ${cooldownDaysLeft} ngày nữa để hủy liên kết ví.`);
      return;
    }

    const confirmed = window.confirm(
      `Unlink wallet ${primaryLinkedWallet.address.slice(0, 6)}...${primaryLinkedWallet.address.slice(-4)}?`
    );
    if (!confirmed) return;

    setIsUnlinkingWallet(true);

    try {
      await unlinkWallet({
        walletId: primaryLinkedWallet.id,
        address: primaryLinkedWallet.address,
      });
      await refresh();
      disconnect();
      toast.success('Wallet unlinked');
    } catch (err: any) {
      console.error('[WalletCenter] Unlink wallet error:', err);
      toast.error(err?.message || 'Unable to unlink wallet');
    } finally {
      setIsUnlinkingWallet(false);
    }
  }, [cooldownDaysLeft, disconnect, isCooldownActive, primaryLinkedWallet, refresh, unlinkWallet]);

  // Copy handler
  const copyExternalAddress = useCallback(() => {
    const addr = address || primaryLinkedWalletAddress;
    if (addr) {
      navigator.clipboard.writeText(addr);
      setCopiedExternal(true);
      toast.success('Address copied');
      setTimeout(() => setCopiedExternal(false), 2000);
    }
  }, [address, primaryLinkedWalletAddress]);

  // Format helpers
  const formatNumber = (num: number, decimals: number = 0) => {
    const fixed = num.toFixed(decimals);
    const [integerPart, decimalPart] = fixed.split('.');
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (decimals > 0 && decimalPart) return `${formattedInteger},${decimalPart}`;
    return formattedInteger;
  };

  const formatUsd = (num: number) => `$${formatNumber(num, 2)}`;

  // Has any wallet?
  const hasAnyWallet = useMemo(() => {
    return !!(primaryLinkedWalletAddress || isConnected);
  }, [primaryLinkedWalletAddress, isConnected]);

  // Show connect wallet screen if no wallet at all
   if (!hasAnyWallet && !isConnected && showDisconnectedUI) {
    return (
      <div className="space-y-4">
        {/* Header with network selector */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <h1 className="text-xl font-bold text-gray-900">My Wallet</h1>
          <WalletNetworkSelector value={activeNetwork} onChange={setActiveNetwork} />
        </div>

        {activeNetwork === 'BTC_TESTNET' ? (
          <BitcoinWalletPanel />
        ) : (
          /* Connect BSC Wallet Card */
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-green-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
              <Wallet className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Kết nối ví để tiếp tục</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Kết nối ví của bạn (MetaMask, Bitget, Trust Wallet, FUN Wallet) để xem tài sản và thực hiện giao dịch trên BNB Smart Chain
            </p>
            <Button
              onClick={handleConnect}
              className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-yellow-300 font-bold text-lg px-10 py-6 rounded-xl shadow-lg hover:shadow-green-500/40 transition-all duration-300 hover:scale-105"
            >
              <Wallet className="w-6 h-6 mr-2" />
              Connect Wallet
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Main wallet UI - single column layout
  const networkLabel =
    networkChainId === bsc.id
      ? 'BSC Mainnet'
      : networkChainId === 97
        ? 'BSC Testnet'
        : networkChainId === 1
          ? 'Ethereum'
          : null;

  if (activeNetwork === 'BTC_TESTNET') {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="bg-primary text-white">
                {profile?.username?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-bold text-gray-900">My Wallet</h1>
              <p className="text-sm text-muted-foreground">{profile?.username || 'Account'}</p>
            </div>
          </div>
          <WalletNetworkSelector value={activeNetwork} onChange={setActiveNetwork} />
        </div>
        <BitcoinWalletPanel />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary text-white">
              {profile?.username?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold text-gray-900">My Wallet</h1>
            <p className="text-sm text-muted-foreground">{profile?.username || 'Account'}</p>
          </div>
        </div>
        <WalletNetworkSelector value={activeNetwork} onChange={setActiveNetwork} />
      </div>

      {/* Single Column Layout - External Wallet Only */}
      <div className="w-full">
        <WalletCard
          walletType="external"
          walletAddress={address || primaryLinkedWalletAddress || null}
          walletName={getWalletDisplayName()}
          connectorType={connectedWalletType}
          isConnected={isConnected}
          isWrongNetwork={isWrongNetwork}
          isCheckingNetwork={isCheckingNetwork}
          networkLabel={networkLabel}
          networkError={networkError}
          isStandalonePwa={pwaMode}
          isLinkedToProfile={!!primaryLinkedWalletAddress}
          tokens={externalTokens}
          totalUsdValue={externalTotalValue}
          isTokensLoading={isExternalLoading}
          copied={copiedExternal}
          onCopy={copyExternalAddress}
          onRefresh={refetchExternal}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onLink={linkWalletToProfile}
          onUnlink={unlinkWalletFromProfile}
          onSwitchAccount={handleSwitchAccount}
          onSwitchNetwork={handleSwitchNetwork}
          onRetryNetworkCheck={retryNetworkCheck}
          isSwitchingNetwork={isSwitchingNetwork}
          isOpeningConnect={isOpeningConnect}
          onReceive={() => setShowReceive(true)}
          onSend={handleOpenSend}
          onSwap={() => setShowSwap(true)}
          onBuy={() => setShowBuy(true)}
          isLinkingWallet={isLinkingWallet}
          isUnlinkingWallet={isUnlinkingWallet}
          isCooldownActive={isCooldownActive}
          cooldownDaysLeft={cooldownDaysLeft}
        />
      </div>

      {/* Gift History */}
      <GiftHistoryPanel userId={currentUserId} />

      {/* Reward Ready to Claim */}
      {(() => {
        const rewardStatus = profile?.reward_status || 'pending';
        const adminNotes = profile?.admin_notes;
        
        const statusConfig = {
          pending: { bg: 'bg-gradient-to-r from-gray-400 via-gray-500 to-gray-600', label: 'Đang chờ duyệt', labelColor: 'text-gray-900', disabled: true },
          approved: { bg: 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500', label: 'Sẵn sàng Claim', labelColor: 'text-yellow-900', disabled: false },
          on_hold: { bg: 'bg-gradient-to-r from-yellow-600 via-orange-500 to-amber-600', label: 'Đang treo', labelColor: 'text-yellow-100', disabled: true },
          rejected: { bg: 'bg-gradient-to-r from-red-500 via-red-600 to-red-700', label: 'Đã từ chối', labelColor: 'text-white', disabled: true }
        };
        
        const config = statusConfig[rewardStatus as keyof typeof statusConfig] || statusConfig.pending;
        
        return (
          <div className={`${config.bg} rounded-xl p-4 flex items-center justify-between shadow-lg flex-wrap gap-3`}>
            <div className="flex items-center gap-3">
              <Gift className={`w-6 h-6 ${config.labelColor}`} />
              <div className="flex flex-col">
                <span className={`font-semibold ${config.labelColor}`}>
                  Claimable: {formatNumber(claimableReward, 0)} CAMLY (~{formatUsd(claimableReward * camlyPrice)})
                </span>
                <span className={`text-xs ${config.labelColor} opacity-80`}>Trạng thái: {config.label}</span>
              </div>
              {(rewardStatus === 'on_hold' || rewardStatus === 'rejected') && adminNotes && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className={`p-1 rounded-full ${rewardStatus === 'rejected' ? 'bg-white/20' : 'bg-yellow-900/20'}`}>
                        <Info className={`w-4 h-4 ${config.labelColor}`} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-sm font-medium mb-1">Ghi chú từ Admin:</p>
                      <p className="text-sm">{adminNotes}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Button 
              className={`font-semibold px-6 shadow-md transition-all ${
                (config.disabled || isTrustBlocked)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-white text-yellow-700 hover:bg-yellow-50 hover:shadow-lg border-2 border-yellow-600'
              }`}
              onClick={() => {
                if (isTrustBlocked) {
                  toast.warning('Please verify your email to unlock rewards.');
                  return;
                }

                if (config.disabled) {
                  if (rewardStatus === 'pending') toast.info('Phần thưởng đang chờ Admin duyệt');
                  else if (rewardStatus === 'on_hold') toast.warning('Phần thưởng đang bị treo. Vui lòng liên hệ Admin.');
                  else if (rewardStatus === 'rejected') toast.error('Phần thưởng đã bị từ chối. Vui lòng liên hệ Admin.');
                } else {
                  setShowClaimDialog(true);
                }
              }}
              disabled={config.disabled || isTrustBlocked}
            >
              {isTrustBlocked ? 'Verify Email Required' : config.disabled ? (
                rewardStatus === 'on_hold' ? <><AlertTriangle className="w-4 h-4 mr-1" /> Đang treo</> :
                rewardStatus === 'rejected' ? 'Đã từ chối' : 'Chờ duyệt'
              ) : 'Claim to Wallet'}
            </Button>
          </div>
        );
      })()}

      {/* Reward Breakdown */}
      <RewardBreakdown 
        stats={rewardStats} 
        claimedAmount={claimedAmount} 
        isLoading={isRewardLoading} 
      />

      {/* Reward Formula Card */}
      <RewardFormulaCard defaultOpen={false} />

      {/* Receive Dialog */}
      <Dialog open={showReceive} onOpenChange={setShowReceive}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nhận tiền</DialogTitle>
          </DialogHeader>
          <ReceiveTab 
            walletAddress={address || primaryLinkedWalletAddress || undefined} 
          />
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      <Dialog open={showSend} onOpenChange={handleSendDialogChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gửi tiền</DialogTitle>
          </DialogHeader>
          <SendTab initialToken={sendInitialToken} />
        </DialogContent>
      </Dialog>

      {/* Swap Dialog */}
      <Dialog open={showSwap} onOpenChange={setShowSwap}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Swap token</DialogTitle>
          </DialogHeader>
          <SwapTab onSwapSuccess={refetchExternal} />
        </DialogContent>
      </Dialog>

      {/* Buy Dialog */}
      <Dialog open={showBuy} onOpenChange={setShowBuy}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buy crypto</DialogTitle>
          </DialogHeader>
          <BuyTab
            walletAddress={address || primaryLinkedWalletAddress}
            isConnected={isConnected}
            chainId={networkChainId}
            onOpenProvider={(url) => {
              const popup = window.open(url, '_blank', 'noopener,noreferrer');
              if (!popup) {
                toast.error('Trinh duyet dang chan popup. Vui long cho phep mo tab moi.');
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Claim Reward Dialog */}
      <ClaimRewardDialog
        open={showClaimDialog}
        onOpenChange={setShowClaimDialog}
        claimableAmount={claimableReward}
        externalWallet={primaryLinkedWalletAddress || (isConnected ? address : null) || null}
        camlyPrice={camlyPrice}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['wallet-rewards', currentUserId] });
          refetchExternal();
        }}
      />
    </div>
  );
};

export default WalletCenterContainer;
