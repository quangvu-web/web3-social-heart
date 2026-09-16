import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type GiftStatus = 'pending' | 'confirmed' | 'failed';
export type GiftToken = 'BNB' | 'CAMLY' | 'USDT';

export interface GiftHistoryRow {
  id: string;
  created_at: string;
  token: GiftToken;
  amount_numeric: number;
  status: GiftStatus;
  tx_hash: string | null;
  to_address: string;
  from_user_id: string;
  to_user_id: string;
  conversation_id: string | null;
  from_profile?: { username: string | null } | null;
  to_profile?: { username: string | null } | null;
  conversation?: { name: string | null } | null;
}

const fetchGiftHistory = async (userId: string, direction: 'sent' | 'received') => {
  const column = direction === 'sent' ? 'from_user_id' : 'to_user_id';
  const { data, error } = await supabase
    .from('crypto_gifts')
    .select(`
      id,
      created_at,
      token,
      amount_numeric,
      status,
      tx_hash,
      to_address,
      from_user_id,
      to_user_id,
      conversation_id,
      from_profile:profiles!crypto_gifts_from_user_id_fkey(username),
      to_profile:profiles!crypto_gifts_to_user_id_fkey(username),
      conversation:conversations(name)
    `)
    .eq(column, userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data || []) as GiftHistoryRow[];
};

export const useGiftHistory = (userId: string | null) => {
  const sentQuery = useQuery({
    queryKey: ['gift-history', userId, 'sent'],
    queryFn: () => fetchGiftHistory(userId!, 'sent'),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const receivedQuery = useQuery({
    queryKey: ['gift-history', userId, 'received'],
    queryFn: () => fetchGiftHistory(userId!, 'received'),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return {
    sent: sentQuery.data || [],
    received: receivedQuery.data || [],
    isLoading: sentQuery.isLoading || receivedQuery.isLoading,
    error: sentQuery.error || receivedQuery.error,
    refetchSent: sentQuery.refetch,
    refetchReceived: receivedQuery.refetch,
  };
};

export default useGiftHistory;
