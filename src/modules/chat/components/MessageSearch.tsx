import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X, Loader2, MessageSquare } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface MessageSearchProps {
  conversationId: string;
  onSelectMessage?: (messageId: string) => void;
  onClose?: () => void;
  participants?: Array<{ id: string; username: string }>;
  excludedSenderIds?: string[];
}

interface SearchResult {
  id: string;
  content: string | null;
  created_at: string | null;
  sender_id: string;
  sender: {
    id: string;
    username: string;
    avatar_url: string | null;
  } | null;
}

export function MessageSearch({
  conversationId,
  onSelectMessage,
  onClose,
  participants,
  excludedSenderIds = [],
}: MessageSearchProps) {
  const [search, setSearch] = useState('');
  const [senderId, setSenderId] = useState<string>('all');
  const debouncedSearch = useDebounce(search, 400);
  const normalizedSearch = debouncedSearch.trim();
  const excludedSenderIdsKey = excludedSenderIds.slice().sort().join(',');

  const { data: results, isLoading } = useQuery({
    queryKey: ['message-search', conversationId, normalizedSearch, senderId, excludedSenderIdsKey],
    queryFn: async () => {
      if (!normalizedSearch || normalizedSearch.length < 2) return [];

      const escapeIlikePattern = (value: string) => value.replace(/[%_]/g, '\\$&');
      const pattern = `%${escapeIlikePattern(normalizedSearch)}%`;

      let query = supabase
        .from('messages')
        .select('id, content, created_at, sender_id')
        .eq('conversation_id', conversationId)
        .ilike('content', pattern);

      if (senderId !== 'all') {
        query = query.eq('sender_id', senderId);
      }

      const { data: messages, error } = await query
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!messages?.length) return [];

      const excluded = new Set(excludedSenderIds);
      const filteredMessages = messages.filter((m) => !excluded.has(m.sender_id));
      if (!filteredMessages.length) return [];

      // Fetch sender profiles
      const senderIds = [...new Set(filteredMessages.map((m) => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', senderIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return filteredMessages.map((m) => ({
        ...m,
        sender: profileMap.get(m.sender_id) || null,
      })) as SearchResult[];
    },
    enabled: normalizedSearch.length >= 2,
  });

  const handleSelect = useCallback(
    (messageId: string) => {
      onSelectMessage?.(messageId);
    },
    [onSelectMessage]
  );

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const highlightMatch = (text: string | null, query: string) => {
    if (!text) return null;
    const safe = escapeRegExp(query);
    const parts = text.split(new RegExp(`(${safe})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-primary/30 text-foreground rounded-sm px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
      <div className="flex items-center gap-2 p-3 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm tin nhắn..."
            className="pl-9"
            autoFocus
          />
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Sender filter */}
      <div className="flex items-center gap-2 p-3 border-b bg-card">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Người gửi</span>
        <Select value={senderId} onValueChange={setSenderId}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Tất cả" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            {participants?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !normalizedSearch || normalizedSearch.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <p>Nhập từ khóa để tìm kiếm</p>
          </div>
        ) : results?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mb-4 opacity-50" />
            <p>Không tìm thấy kết quả</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {results?.map((result) => (
              <button
                key={result.id}
                onClick={() => handleSelect(result.id)}
                className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-accent text-left transition-colors"
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={result.sender?.avatar_url || undefined} />
                  <AvatarFallback>{(result.sender?.username || 'U')[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{result.sender?.username}</span>
                    {result.created_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(result.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {result.content
                      ? highlightMatch(result.content, normalizedSearch)
                      : '[Tin nhắn không có văn bản]'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
