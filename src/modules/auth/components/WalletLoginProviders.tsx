import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WalletLoginContent } from './WalletLoginContent';

interface WalletLoginProvidersProps {
  onSuccess: (userId: string, isNewUser: boolean) => void;
}

export const WalletLoginProviders = ({ onSuccess }: WalletLoginProvidersProps) => {
  return (
    <RainbowKitProvider
      theme={darkTheme({
        accentColor: '#2563EB',
        accentColorForeground: 'white',
        borderRadius: 'large',
      })}
    >
      <WalletLoginContent onSuccess={onSuccess} />
    </RainbowKitProvider>
  );
};
