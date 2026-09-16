import { lazy, Suspense } from 'react';
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

// Lazy load the wallet container
const WalletCenterContainer = lazy(() => import('@/components/wallet/WalletCenterContainer'));

// Loading fallback for wallet content
const WalletLoader = () => (
  <div className="flex items-center justify-center py-20">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-muted-foreground">Đang tải ví...</p>
    </div>
  </div>
);

const WalletProviders = () => {
  return (
    <RainbowKitProvider>
      <Suspense fallback={<WalletLoader />}>
        <WalletCenterContainer />
      </Suspense>
    </RainbowKitProvider>
  );
};

export default WalletProviders;
