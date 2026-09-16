import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLiveMessages } from '../hooks/useLiveMessages';
import { supabase } from '@/integrations/supabase/client';

interface LiveChatPanelProps {
  sessionId: string;
  className?: string;
}

export function LiveChatPanel({ sessionId, className }: LiveChatPanelProps) {
  const { messages, sendMessage, isLoading } = useLiveMessages(sessionId);
  const [text, setText] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const value = text.trim();
    if (!value) return;
    await sendMessage(value);
    setText('');
  };

  return (
    <div className={className}>
      <div className="border rounded-xl bg-card h-full flex flex-col">
        <div className="px-3 py-2 border-b font-semibold text-sm">Live Chat</div>

        <ScrollArea className="flex-1 px-3">
          <div className="space-y-3 py-3">
            {isLoading && <div className="text-xs text-muted-foreground">Loading chat...</div>}
            {!isLoading &&
              messages.map((msg) => (
                <div key={msg.id} className="flex gap-2">
                  <Avatar className="h-7 w-7 mt-0.5">
                    <AvatarImage src={msg.profile?.avatar_url || ''} />
                    <AvatarFallback className="text-xs">
                      {msg.profile?.username?.charAt(0)?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{msg.profile?.username || 'User'}</div>
                    <div className="text-sm break-words">{msg.content}</div>
                  </div>
                </div>
              ))}
            <div ref={endRef} />
          </div>
        </ScrollArea>

        {isAuthenticated ? (
          <div className="p-2 border-t flex items-center gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Viết bình luận..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
            />
            <Button size="icon" variant="ghost" onClick={handleSend}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="p-3 border-t text-center text-xs text-muted-foreground">
            <span>Đăng nhập để bình luận</span>
          </div>
        )}
      </div>
    </div>
  );
}
