import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChatSettings {
  id: string;
  user_id: string;
  who_can_message: string | null;
  show_read_receipts: boolean | null;
  show_typing_indicator: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

const DEFAULT_SETTINGS: Omit<ChatSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  who_can_message: 'friends',
  show_read_receipts: true,
  show_typing_indicator: true,
};

export function useChatSettings(userId: string | null) {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['chat-settings', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('chat_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      // Return settings with defaults
      if (!data) {
        return {
          user_id: userId,
          ...DEFAULT_SETTINGS,
        } as ChatSettings;
      }

      return data;
    },
    enabled: !!userId,
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<ChatSettings>) => {
      if (!userId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('chat_settings')
        .upsert(
          {
            user_id: userId,
            ...updates,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-settings', userId] });
    },
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    error: settingsQuery.error,
    updateSettings,
  };
}

// Check if a user can message another user (evaluated server-side)
export async function canSendMessage(_senderId: string, receiverId: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc('can_user_message', {
    p_receiver_id: receiverId,
  });

  if (error) {
    console.warn('[useChatSettings] can_user_message error:', error);
    return false;
  }

  return data === true;
}
