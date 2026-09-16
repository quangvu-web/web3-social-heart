import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const WalletLoginProviders = lazy(() =>
  import('./WalletLoginProviders').then((m) => ({ default: m.WalletLoginProviders }))
);

interface WalletLoginProps {
  onSuccess: (userId: string, isNewUser: boolean) => void;
}

export const WalletLogin = ({ onSuccess }: WalletLoginProps) => {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      }
    >
      <WalletLoginProviders onSuccess={onSuccess} />
    </Suspense>
  );
};
