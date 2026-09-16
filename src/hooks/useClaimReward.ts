import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ClaimResult {
  success: boolean;
  tx_hash: string;
  amount: number;
  wallet_address: string;
  block_number: string;
  message: string;
  bscscan_url: string;
}

interface ClaimError {
  error: string;
  message: string;
}

export const useClaimReward = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const queryClient = useQueryClient();

  const claimReward = useCallback(async (amount: number, walletAddress: string): Promise<ClaimResult | null> => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Vui lòng đăng nhập để tiếp tục');
      }

      const response = await supabase.functions.invoke('claim-reward', {
        body: {
          wallet_address: walletAddress,
          amount: amount,
        },
      });

      if (response.error) {
        const errorMsg = response.error.message || 'Lỗi không xác định';
        setError(errorMsg);
        toast.error(errorMsg);
        return null;
      }

      const data = response.data as ClaimResult | ClaimError;

      if ('error' in data) {
        setError(data.message);
        toast.error(data.message);
        return null;
      }

      // Success!
      setTxHash(data.tx_hash);
      setResult(data);
      
      // Invalidate reward stats cache to refresh claimable amount
      queryClient.invalidateQueries({ queryKey: ['reward-stats'] });
      
      return data;

    } catch (err: any) {
      const message = err.message || 'Lỗi khi claim reward';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [queryClient]);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setTxHash(null);
    setResult(null);
  }, []);

  return {
    claimReward,
    isLoading,
    error,
    txHash,
    result,
    reset,
  };
};

export default useClaimReward;
