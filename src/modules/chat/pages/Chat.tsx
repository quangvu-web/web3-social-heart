import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useConversations } from '../hooks/useConversations';
import { useGroupConversations } from '../hooks/useGroupConversations';
import { useChatNotifications } from '../hooks/useChatNotifications';
import { ConversationList } from '../components/ConversationList';
import { MessageThread } from '../components/MessageThread';
import { NewConversationDialog } from '../components/NewConversationDialog';
import { CreateGroupDialog } from '../components/CreateGroupDialog';
import { ChatSettingsDialog } from '../components/ChatSettingsDialog';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { useIsMobileOrTablet } from '@/hooks/use-mobile';
import { ArrowLeft, MessageSquarePlus, Users, Settings, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Conversation } from '../types';

const getDisplayName = (conv: Conversation, uid: string | null): string => {
  if (conv.type === 'group') return conv.name || 'Nhóm chat';
  const other = conv.participants?.find(p => p.user_id !== uid && !p.left_at);
  return other?.profile?.full_name || other?.profile?.username || 'Người dùng';
};

export default function Chat() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const isMobileOrTablet = useIsMobileOrTablet();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const sidebarSettingsBtnRef = useRef<HTMLButtonElement | null>(null);
  const sidebarComposeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedSidebarControlRef = useRef<'settings' | 'compose' | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      setUsername(profile?.username || null);
    };

    checkAuth();
  }, [navigate]);

  const { conversations, isLoading, createDirectConversation } = useConversations(userId);
  const { createGroupConversation } = useGroupConversations(userId);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter(conv => {
      const name = getDisplayName(conv, userId).toLowerCase();
      const preview = (conv.last_message_preview || '').toLowerCase();
      return name.includes(q) || preview.includes(q);
    });
  }, [conversations, searchQuery, userId]);

  useChatNotifications(userId, conversationId || null);

  const handleSelectConversation = (id: string) => {
    navigate(`/chat/${id}`);
  };

  const handleBack = () => {
    navigate('/chat');
  };

  const handleNewConversation = async (otherUserId: string) => {
    const result = await createDirectConversation.mutateAsync(otherUserId);
    if (result) {
      navigate(`/chat/${result.id}`);
    }
    setShowNewConversation(false);
  };

  const handleCreateGroup = async (name: string, memberIds: string[]) => {
    const result = await createGroupConversation.mutateAsync({ name, memberIds });
    if (result) {
      navigate(`/chat/${result.id}`);
    }
    setShowCreateGroup(false);
  };

  useEffect(() => {
    if (isMobileOrTablet) return;
    const control = lastFocusedSidebarControlRef.current;
    const target =
      control === 'settings'
        ? sidebarSettingsBtnRef.current
        : control === 'compose'
          ? sidebarComposeBtnRef.current
          : null;
    target?.focus({ preventScroll: true });
  }, [conversationId, isMobileOrTablet]);

  if (isMobileOrTablet) {
    return (
      <div className="h-screen overflow-hidden bg-background flex flex-col">
        <FacebookNavbar />
        <main className="flex-1 pt-14 pb-20 overflow-hidden">
          {conversationId ? (
            <div className="h-full min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 p-3 border-b bg-card">
                <Button variant="ghost" size="icon" onClick={handleBack}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <span className="font-medium">Tin nhắn</span>
              </div>
              <MessageThread conversationId={conversationId} userId={userId} username={username} />
            </div>
          ) : (
            <div className="h-full min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h1 className="text-xl font-bold">Tin nhắn</h1>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSettings(true)}
                    className="border border-transparent hover:border-[#C9A84C]/40 rounded-full"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="border border-transparent hover:border-[#C9A84C]/40 rounded-full"
                      >
                        <MessageSquarePlus className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowNewConversation(true)}>
                        <MessageSquarePlus className="h-4 w-4 mr-2" />
                        Tin nhắn mới
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowCreateGroup(true)}>
                        <Users className="h-4 w-4 mr-2" />
                        Tạo nhóm
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {/* Search bar - mobile */}
              <div className="px-4 py-2 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm hội thoại..."
                    className="pl-9 pr-8 h-9 rounded-full bg-muted border-none text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <ConversationList
                conversations={filteredConversations}
                selectedId={null}
                currentUserId={userId}
                onSelect={handleSelectConversation}
                isLoading={isLoading}
                isSearching={!!searchQuery.trim()}
              />
            </div>
          )}
        </main>
        <MobileBottomNav />

        <NewConversationDialog
          open={showNewConversation}
          onOpenChange={setShowNewConversation}
          currentUserId={userId}
          onSelectUser={handleNewConversation}
        />
        <CreateGroupDialog
          open={showCreateGroup}
          onOpenChange={setShowCreateGroup}
          currentUserId={userId}
          onCreateGroup={handleCreateGroup}
          isCreating={createGroupConversation.isPending}
        />
        <ChatSettingsDialog open={showSettings} onOpenChange={setShowSettings} userId={userId} />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      <FacebookNavbar />
      <main className="flex-1 pt-14 overflow-hidden">
        <div className="h-full flex overflow-hidden">
          <aside className="w-80 flex-shrink-0 h-full border-r bg-card overflow-hidden">
            <div className="h-full min-h-0 flex flex-col">
              <div className="sticky top-0 z-10 bg-card flex items-center justify-between p-4 border-b">
                <h1 className="text-xl font-bold">Tin nhắn</h1>
                <div className="flex items-center gap-1">
                  <Button
                    ref={sidebarSettingsBtnRef}
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSettings(true)}
                    onFocus={() => {
                      lastFocusedSidebarControlRef.current = 'settings';
                    }}
                    className="border border-transparent hover:border-[#C9A84C]/40 rounded-full"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        ref={sidebarComposeBtnRef}
                        variant="ghost"
                        size="icon"
                        onFocus={() => {
                          lastFocusedSidebarControlRef.current = 'compose';
                        }}
                        className="border border-transparent hover:border-[#C9A84C]/40 rounded-full"
                      >
                        <MessageSquarePlus className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowNewConversation(true)}>
                        <MessageSquarePlus className="h-4 w-4 mr-2" />
                        Tin nhắn mới
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowCreateGroup(true)}>
                        <Users className="h-4 w-4 mr-2" />
                        Tạo nhóm
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {/* Search bar - desktop */}
              <div className="px-4 py-2 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm hội thoại..."
                    className="pl-9 pr-8 h-9 rounded-full bg-muted border-none text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <ConversationList
                conversations={filteredConversations}
                selectedId={conversationId || null}
                currentUserId={userId}
                onSelect={handleSelectConversation}
                isLoading={isLoading}
                isSearching={!!searchQuery.trim()}
              />
            </div>
          </aside>

          <section className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
            {conversationId ? (
              <MessageThread conversationId={conversationId} userId={userId} username={username} />
            ) : (
              <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquarePlus className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Chọn cuộc trò chuyện để bắt đầu</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <NewConversationDialog
        open={showNewConversation}
        onOpenChange={setShowNewConversation}
        currentUserId={userId}
        onSelectUser={handleNewConversation}
      />
      <CreateGroupDialog
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        currentUserId={userId}
        onCreateGroup={handleCreateGroup}
        isCreating={createGroupConversation.isPending}
      />
      <ChatSettingsDialog open={showSettings} onOpenChange={setShowSettings} userId={userId} />
    </div>
  );
}
