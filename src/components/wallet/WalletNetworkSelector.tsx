import { useEffect } from 'react';
import { cn } from '@/lib/utils';

export type WalletViewNetwork = 'BSC' | 'BTC_TESTNET';

const STORAGE_KEY = 'fun_wallet_active_network';

interface WalletNetworkSelectorProps {
  value: WalletViewNetwork;
  onChange: (value: WalletViewNetwork) => void;
}

const OPTIONS: Array<{ value: WalletViewNetwork; label: string; icon: string }> = [
  { value: 'BSC', label: 'BNB Smart Chain', icon: '🟡' },
  { value: 'BTC_TESTNET', label: 'Bitcoin Testnet', icon: '₿' },
];

export const usePersistedNetwork = (): [WalletViewNetwork, (v: WalletViewNetwork) => void] => {
  // This is a helper — actual state lives in the parent.
  // Use getInitialNetwork() for default value.
  return [getInitialNetwork(), () => {}];
};

export function getInitialNetwork(): WalletViewNetwork {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'BSC' || stored === 'BTC_TESTNET') return stored;
  } catch {}
  return 'BSC';
}

export const WalletNetworkSelector = ({ value, onChange }: WalletNetworkSelectorProps) => {
  // Persist selection
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {}
  }, [value]);

  return (
    <div className="w-full rounded-xl bg-slate-100 p-1 grid grid-cols-2 gap-1">
      {OPTIONS.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200',
              isActive
                ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50',
            )}
          >
            <span className="text-base leading-none">{option.icon}</span>
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};
