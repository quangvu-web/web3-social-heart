import { useAccount, useBalance, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { formatEther } from 'viem';

export const WalletHeader = () => {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const { disconnect } = useDisconnect();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(data);
      }
    };
    loadProfile();
  }, []);

  if (!isConnected) {
    return (
      <div className="flex items-center gap-4 p-6 bg-card rounded-lg border">
        <Avatar className="h-16 w-16">
          <AvatarImage src={profile?.avatar_url || ''} />
          <AvatarFallback>{profile?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <ConnectButton />
        </div>
      </div>
    );
  }

  const balanceInUSD = balance ? (parseFloat(formatEther(balance.value)) * 2500).toFixed(2) : '0.00'; // Mock USD price

  return (
    <div className="p-6 bg-card rounded-lg border">
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={profile?.avatar_url || ''} />
          <AvatarFallback>{profile?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <img 
              src="https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg" 
              alt="Wallet" 
              className="h-6 w-6"
            />
            <span className="font-medium">{profile?.username || 'User'}</span>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </div>
          
          <div className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            ${balanceInUSD} USD
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => disconnect()}
            className="mt-2"
          >
            Disconnect
          </Button>
        </div>
      </div>
    </div>
  );
};
