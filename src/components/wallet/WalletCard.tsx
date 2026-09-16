import { useMemo } from 'react';
import { Copy, Check, ArrowDown, ArrowUp, RefreshCw, ShoppingCart, Shield, Wallet, LinkIcon, LogOut, UserRoundCog, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TokenBalance } from '@/hooks/useTokenBalances';
import { cn } from '@/lib/utils';
import type { SendToken } from '@/modules/wallet/services/sendAsset';

import metamaskLogo from '@/assets/metamask-logo.png';
import bitgetLogo from '@/assets/bitget-logo.png';
import trustWalletLogo from '@/assets/trust-wallet-logo.png';
import funProfileLogo from '@/assets/fun-profile-logo.png';
import funWalletLogo from '@/assets/fun-wallet-logo.gif';

interface WalletCardProps {
  walletType: 'custodial' | 'external';
  walletAddress: string | null;
  walletName: string;
  walletLogo?: string;
  connectorType?: 'metamask' | 'bitget' | 'trust' | 'fun' | 'other' | null;
  isConnected?: boolean;
  isWrongNetwork?: boolean;
  isCheckingNetwork?: boolean;
  networkLabel?: string | null;
  networkError?: string | null;
  isStandalonePwa?: boolean;
  isLinkedToProfile?: boolean;
  isLoading?: boolean;
  tokens: TokenBalance[];
  totalUsdValue: number;
  isTokensLoading: boolean;
  copied: boolean;
  onCopy: () => void;
  onRefresh: () => void;
  // Actions
  onConnect?: () => void;
  onDisconnect?: () => void;
  onLink?: () => void;
  onUnlink?: () => void;
  onSwitchAccount?: () => void;
  onSwitchNetwork?: () => void;
  onRetryNetworkCheck?: () => void;
  isSwitchingNetwork?: boolean;
  isOpeningConnect?: boolean;
  onReceive: () => void;
  onSend?: (token?: SendToken) => void;
  onSwap: () => void;
  onBuy: () => void;
  // Loading states for actions
  isLinkingWallet?: boolean;
  isUnlinkingWallet?: boolean;
  isCooldownActive?: boolean;
  cooldownDaysLeft?: number | null;
}

// Formatting helpers
const formatNumber = (num: number, decimals: number = 0) => {
  const fixed = num.toFixed(decimals);
  const [integerPart, decimalPart] = fixed.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (decimals > 0 && decimalPart) {
    return `${formattedInteger},${decimalPart}`;
  }
  return formattedInteger;
};

const formatUsd = (num: number) => `$${formatNumber(num, 2)}`;

const formatTokenBalance = (num: number) => {
  if (num > 0 && num < 0.000001) return formatNumber(num, 8);
  if (num > 0 && num < 0.01) return formatNumber(num, 6);
  if (Number.isInteger(num) || Math.abs(num - Math.round(num)) < 0.0001) {
    return formatNumber(Math.round(num), 0);
  }
  return formatNumber(num, 4);
};

// Get wallet logo based on type
const getWalletLogo = (connectorType: string | null | undefined) => {
  switch (connectorType) {
    case 'metamask': return metamaskLogo;
    case 'bitget': return bitgetLogo;
    case 'trust': return trustWalletLogo;
    case 'fun': return funWalletLogo;
    default: return metamaskLogo;
  }
};

export const WalletCard = ({
  walletType,
  walletAddress,
  walletName,
  walletLogo,
  connectorType,
  isConnected = false,
  isWrongNetwork = false,
  isCheckingNetwork = false,
  networkLabel = null,
  networkError = null,
  isStandalonePwa = false,
  isLinkedToProfile = false,
  isLoading = false,
  tokens,
  totalUsdValue,
  isTokensLoading,
  copied,
  onCopy,
  onRefresh,
  onConnect,
  onDisconnect,
  onLink,
  onUnlink,
  onSwitchAccount,
  onSwitchNetwork,
  onRetryNetworkCheck,
  isSwitchingNetwork = false,
  isOpeningConnect = false,
  onReceive,
  onSend,
  onSwap,
  onBuy,
  isLinkingWallet = false,
  isUnlinkingWallet = false,
  isCooldownActive = false,
  cooldownDaysLeft = null,
}: WalletCardProps) => {
  const isCustodial = walletType === 'custodial';
  const supportedSendTokens = useMemo(() => new Set<SendToken>(['BNB', 'USDT', 'BTCB', 'CAMLY', 'FUN']), []);

  // Determine actual logo to use
  const displayLogo = useMemo(() => {
    if (isCustodial) return funProfileLogo;
    return walletLogo || getWalletLogo(connectorType);
  }, [isCustodial, walletLogo, connectorType]);

  // Shortened address
  const shortenedAddress = useMemo(() => {
    if (isLoading) return 'Đang tải...';
    if (walletAddress) {
      return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    }
    return 'Chưa có ví';
  }, [walletAddress, isLoading]);

  // Header gradient colors
  const headerGradient = isCustodial
    ? 'from-emerald-700 via-emerald-600 to-green-500'
    : 'from-orange-600 via-amber-500 to-yellow-400';

  // Card border color
  const borderColor = isCustodial ? 'border-emerald-200' : 'border-orange-200';
  const canOpenSend = Boolean(walletAddress && (!networkError || isWrongNetwork));
  const canOpenTokenSend = Boolean(canOpenSend && isConnected && !isCheckingNetwork);

  return (
    <div className={cn(
      'bg-white rounded-2xl shadow-lg overflow-hidden border-2 transition-all hover:shadow-xl',
      borderColor
    )}>
      {/* Header */}
      <div className={cn('bg-gradient-to-r p-4', headerGradient)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isCustodial ? (
              <Shield className="w-5 h-5 text-yellow-300" />
            ) : (
              <img src={displayLogo} alt={walletName} className="w-5 h-5" />
            )}
            <span className="font-bold text-white text-sm">
              {walletName}
            </span>
          </div>
          
          {/* Status Badge */}
          <div className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium',
            isCustodial
              ? 'bg-emerald-900/30 text-emerald-100'
              : isConnected && isCheckingNetwork
                ? 'bg-blue-500/30 text-blue-100'
              : isConnected && networkError
                ? 'bg-amber-500/30 text-amber-100'
              : isConnected && isWrongNetwork
                ? 'bg-red-500/30 text-red-100'
              : isConnected
                  ? isLinkedToProfile
                    ? 'bg-green-500/30 text-green-100'
                    : 'bg-yellow-500/30 text-yellow-100'
                  : 'bg-white/20 text-white/80'
          )}>
            {isCustodial
              ? 'Custodial'
              : isConnected && isCheckingNetwork
                ? 'Checking network...'
              : isConnected && networkError
                ? 'Network issue'
              : isConnected && isWrongNetwork
                ? 'Wrong network'
                : isConnected
                  ? isLinkedToProfile
                    ? networkLabel ? `Linked (${networkLabel})` : 'Linked'
                    : networkLabel ? `Connected (${networkLabel})` : 'Connected'
                  : 'Not Connected'
            }
          </div>
        </div>

        {/* Address */}
        <div className="flex items-center gap-2">
          <button 
            onClick={onCopy}
            disabled={!walletAddress}
            className="flex items-center gap-1 text-white/90 hover:text-white transition-colors bg-white/10 px-3 py-1.5 rounded-full"
          >
            <span className="text-sm font-mono">{shortenedAddress}</span>
            {copied ? <Check className="w-4 h-4 text-green-300" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Total Value */}
      <div className="px-4 py-4 border-b bg-gradient-to-b from-gray-50 to-white">
        <p className="text-xs text-muted-foreground mb-1">Total Assets</p>
        {isTokensLoading ? (
          <div className="animate-pulse bg-gray-200 rounded h-8 w-32" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">
            {formatUsd(totalUsdValue)}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-4 border-b bg-gray-50/50">
        <div className="flex justify-between gap-2">
          <button 
            onClick={onReceive}
            disabled={!walletAddress}
            className="flex-1 flex flex-col items-center gap-1 p-3 bg-white rounded-xl border hover:bg-gray-50 hover:border-primary transition-all disabled:opacity-50"
          >
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              isCustodial ? 'bg-emerald-100' : 'bg-orange-100'
            )}>
              <ArrowDown className={cn('w-5 h-5', isCustodial ? 'text-emerald-600' : 'text-orange-600')} />
            </div>
            <span className="text-xs font-medium text-gray-600">Receive</span>
          </button>

          <button 
            onClick={() => onSend?.()}
            disabled={!walletAddress || (!!networkError && !isWrongNetwork)}
            className="flex-1 flex flex-col items-center gap-1 p-3 bg-white rounded-xl border hover:bg-gray-50 hover:border-primary transition-all disabled:opacity-50"
          >
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              isCustodial ? 'bg-emerald-100' : 'bg-orange-100'
            )}>
              <ArrowUp className={cn('w-5 h-5', isCustodial ? 'text-emerald-600' : 'text-orange-600')} />
            </div>
            <span className="text-xs font-medium text-gray-600">Send</span>
          </button>

          <button 
            onClick={onSwap}
            disabled={!!networkError && !isWrongNetwork}
            className="flex-1 flex flex-col items-center gap-1 p-3 bg-white rounded-xl border hover:bg-gray-50 hover:border-primary transition-all"
          >
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              isCustodial ? 'bg-emerald-100' : 'bg-orange-100'
            )}>
              <RefreshCw className={cn('w-5 h-5', isCustodial ? 'text-emerald-600' : 'text-orange-600')} />
            </div>
            <span className="text-xs font-medium text-gray-600">Swap</span>
          </button>

          <button 
            onClick={onBuy}
            className="flex-1 flex flex-col items-center gap-1 p-3 bg-white rounded-xl border hover:bg-gray-50 hover:border-primary transition-all"
          >
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              isCustodial ? 'bg-emerald-100' : 'bg-orange-100'
            )}>
              <ShoppingCart className={cn('w-5 h-5', isCustodial ? 'text-emerald-600' : 'text-orange-600')} />
            </div>
            <span className="text-xs font-medium text-gray-600">Buy</span>
          </button>
        </div>
      </div>

      {/* External Wallet Actions */}
      {!isCustodial && (
        <div className="px-4 py-2 bg-orange-50/50 border-b flex items-center gap-2 flex-wrap">
          {!isConnected ? (
            <Button
              onClick={onConnect}
              disabled={isOpeningConnect}
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Wallet className="w-4 h-4 mr-1" />
              {isOpeningConnect ? 'Opening...' : 'Connect Wallet'}
            </Button>
          ) : (
            <>
              {/* Link/Unlink buttons */}
              {!isLinkedToProfile ? (
                <Button
                  onClick={onLink}
                  disabled={isLinkingWallet}
                  size="sm"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  {isLinkingWallet ? (
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <LinkIcon className="w-4 h-4 mr-1" />
                  )}
                  Liên kết với Profile
                </Button>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={onUnlink}
                        disabled={isUnlinkingWallet || isCooldownActive}
                        size="sm"
                        variant="ghost"
                        className="text-orange-600 hover:bg-orange-100"
                      >
                        {isUnlinkingWallet ? (
                          <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <LogOut className="w-4 h-4 mr-1" />
                        )}
                        {isCooldownActive && cooldownDaysLeft != null
                          ? `Chờ ${cooldownDaysLeft} ngày`
                          : 'Hủy liên kết'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Xóa ví khỏi tài khoản</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              <Button
                onClick={onSwitchAccount}
                size="sm"
                variant="ghost"
                className="text-blue-600 hover:bg-blue-100"
              >
                <UserRoundCog className="w-4 h-4 mr-1" />
                Switch
              </Button>

              {isWrongNetwork && onSwitchNetwork && (
                <Button
                  onClick={onSwitchNetwork}
                  disabled={isSwitchingNetwork}
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-100"
                >
                  {isSwitchingNetwork ? (
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 mr-1" />
                  )}
                  {isSwitchingNetwork ? 'Switching...' : 'Switch Network'}
                </Button>
              )}

              <Button
                onClick={onDisconnect}
                size="sm"
                variant="ghost"
                className="text-red-500 hover:bg-red-100"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Disconnect
              </Button>
            </>
          )}
        </div>
      )}

      {!isCustodial && isConnected && networkError && (
        <div className="px-4 py-3 border-b bg-amber-50">
          <p className="text-sm font-semibold text-amber-900">Khong the xac dinh mang cua vi.</p>
          <p className="text-xs text-amber-800 mt-1">
            {isStandalonePwa
              ? 'Thu Refresh trang hoac Disconnect -> Connect lai tu wallet app.'
              : 'Thu Refresh hoac reconnect wallet.'}
          </p>
          {onRetryNetworkCheck && (
            <Button
              onClick={onRetryNetworkCheck}
              size="sm"
              variant="outline"
              className="mt-3 border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh Network
            </Button>
          )}
        </div>
      )}

      {/* Tokens List */}
      <div className="divide-y">
        <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-600">Tokens</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isTokensLoading}
            className="text-xs text-muted-foreground hover:text-primary h-7 px-2"
          >
            <RefreshCw className={cn('w-3 h-3 mr-1', isTokensLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {tokens.map((token) => {
          const tokenSymbol = token.symbol.toUpperCase();
          const isSupported = supportedSendTokens.has(tokenSymbol as SendToken);
          const canClickToken = canOpenTokenSend && isSupported;

          return (
            <button
              key={token.symbol}
              type="button"
              onClick={() => {
                if (!canClickToken) return;
                onSend?.(tokenSymbol as SendToken);
              }}
              disabled={!canClickToken}
              className={cn(
                'flex w-full items-center justify-between p-3 text-left transition-colors',
                canClickToken ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
              )}
            >
              <div className="flex items-center gap-3">
                <img 
                  src={token.icon} 
                  alt={token.symbol} 
                  className="w-8 h-8 rounded-full" 
                />
                <div>
                  <p className="font-semibold text-sm">{token.symbol}</p>
                  <div className={cn(
                    'flex items-center text-xs',
                    token.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    <span>{token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            
              <div className="text-right">
                {token.isLoading ? (
                  <>
                    <span className="animate-pulse bg-gray-200 rounded w-14 h-4 inline-block mb-1" />
                    <span className="animate-pulse bg-gray-200 rounded w-16 h-3 inline-block" />
                  </>
                ) : (
                  <>
                    <p className="font-bold text-sm">
                      {formatUsd(token.usdValue)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTokenBalance(token.balance)} {token.symbol}
                    </p>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default WalletCard;
