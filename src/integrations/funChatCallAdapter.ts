import type { ChatCallAdapter } from '@fun/chat-call';
import { supabase } from '@/integrations/supabase/client';
import { getAgoraRtcToken } from '@/lib/agoraRtc';

const PAGE_SIZE = 30;

export const funChatCallAdapter: ChatCallAdapter = {
  getAuth: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      userId: session?.user?.id ?? null,
      accessToken: session?.access_token ?? null,
    };
  },

  fetchAgoraToken: async ({ channelName, role, uid }) => {
    const token = await getAgoraRtcToken(channelName, role);
    return {
      token: token.token,
      appId: token.appId,
      uid: uid ?? token.userAccount,
      channelName,
      expiresAt: token.expiresAt,
    };
  },

  fetchChatHistory: async (conversationId, cursor) => {
    const pageIndex = Number(cursor ?? 0);
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return {
      items: (data ?? []) as any[],
      nextCursor: (data?.length ?? 0) === PAGE_SIZE ? String(pageIndex + 1) : null,
    };
  },

  sendMessage: async (conversationId, payload) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('messages')
      .insert([{
        conversation_id: conversationId,
        sender_id: user.id,
        content: payload.content?.trim() || null,
        media_urls: payload.mediaUrls?.map((m) => m.url) ?? [],
        reply_to_id: payload.replyToId ?? null,
        metadata: (payload.metadata ?? {}) as any,
      }])
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  subscribeRealtime: (conversationId, handlers) => {
    const channel = supabase
      .channel(`fun-chat-call:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          handlers.onMessage?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          handlers.onMessageUpdated?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          if (oldRow?.id) handlers.onMessageDeleted?.(oldRow.id);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        void supabase.removeChannel(channel);
      },
    };
  },

  uploadAttachment: async (file) => {
    const sanitizedName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const path = `chat/${sanitizedName}`;

    const { error } = await supabase.storage.from('chat-media').upload(path, file, {
      upsert: false,
      contentType: file.type,
    });

    if (error) throw error;

    const { data } = supabase.storage.from('chat-media').getPublicUrl(path);

    return {
      url: data.publicUrl,
      type: file.type,
    };
  },
};
