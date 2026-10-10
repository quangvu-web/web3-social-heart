import { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { vi, enUS, zhCN, ja, ko, th, id, fr, es, de, pt, ru, ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/LanguageContext';
import { Users, Search } from 'lucide-react';
import type { Locale } from 'date-fns';
import type { Conversation, ConversationParticipant } from '../types';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  currentUserId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  isSearching?: boolean;
}

const dateLocales: Record<string, Locale> = {
  vi, en: enUS, zh: zhCN, ja, ko, th, id, fr, es, de, pt, ru, ar
};
const conversationListScrollByUser = new Map<string, number>();

export function ConversationList({
  conversations,
  selectedId,
  currentUserId,
  onSelect,
  isLoading,
  isSearching,
}: ConversationListProps) {
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const { t, language } = useLanguage();
  const dateLocale = dateLocales[language] || enUS;

  useEffect(() => {
    const root = scrollRootRef.current as any;
    if (!root) return;

    const viewport = root.querySelector?.('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    if (!viewport) return;

    const key = currentUserId || 'anonymous';
    const cachedTop = conversationListScrollByUser.get(key);
    if (typeof cachedTop === 'number') {
      viewport.scrollTop = cachedTop;
    }

    const onScroll = () => {
      conversationListScrollByUser.set(key, viewport.scrollTop);
    };

    viewport.addEventListener('scroll', onScroll);
    return () => {
      conversationListScrollByUser.set(key, viewport.scrollTop);
      viewport.removeEventListener('scroll', onScroll);
    };
  }, [currentUserId]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-muted-foreground gap-2">
        {isSearching ? (
          <>
            <Search className="h-10 w-10 opacity-40" />
            <p className="text-sm">Không tìm thấy hội thoại nào</p>
          </>
        ) : (
          <p>{t('noConversations')}</p>
        )}
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollRootRef} className="flex-1">
      <div className="p-2">
        {conversations.map((conversation) => {
          const isGroup = conversation.type === 'group';
          const otherParticipant = conversation.participants?.find(
            (p: ConversationParticipant) => p.user_id !== currentUserId && !p.left_at
          );
          const profile = otherParticipant?.profile;
          const participantCount = conversation.participants?.filter(
            (p: ConversationParticipant) => !p.left_at
          ).length || 0;

          const displayName = isGroup
            ? conversation.name
            : profile?.full_name || profile?.username || t('user');

          const avatarUrl = isGroup
            ? conversation.avatar_url
            : profile?.avatar_url;

          return (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-full text-left transition-all duration-300 border hover:bg-card hover:shadow-[0_0_12px_hsl(var(--primary)/0.5)]',
                selectedId === conversation.id ? 'bg-primary/10 border-gold/60' : 'border-transparent hover:border-gold/40'
              )}
            >
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={avatarUrl || undefined} alt={displayName || ''} />
                  <AvatarFallback>
                    {isGroup ? (
                      <Users className="h-5 w-5" />
                    ) : (
                      (displayName || 'U')[0].toUpperCase()
                    )}
                  </AvatarFallback>
                </Avatar>
                {isGroup && (
                  <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5">
                    <Users className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                      'truncate',
                      conversation.unread_count ? 'font-bold text-foreground' : 'font-medium'
                    )}>
                      {displayName}
                    </span>
                    {isGroup && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {participantCount}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    {conversation.last_message_at && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(conversation.last_message_at), {
                          addSuffix: false,
                          locale: dateLocale,
                        })}
                      </span>
                    )}
                    {conversation.unread_count && conversation.unread_count > 0 ? (
                      <span className="min-w-[20px] h-5 px-1.5 bg-destructive text-destructive-foreground text-[11px] font-bold rounded-full flex items-center justify-center leading-none">
                        {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                      </span>
                    ) : null}
                  </div>
                </div>
                {conversation.last_message_preview && (
                  <p className={cn(
                    'text-sm truncate',
                    conversation.unread_count ? 'text-foreground font-medium' : 'text-muted-foreground'
                  )}>
                    {conversation.last_message_preview}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
