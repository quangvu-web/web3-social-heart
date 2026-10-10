import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useConversations } from '@/hooks/useConversations';
import { useGroupConversations } from '@/hooks/useGroupConversations';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { ConversationList } from '@/components/chat/ConversationList';
import { MessageThread } from '@/components/chat/MessageThread';
import { NewConversationDialog } from '@/components/chat/NewConversationDialog';
import { CreateGroupDialog } from '@/components/chat/CreateGroupDialog';
import { ChatSettingsDialog } from '@/components/chat/ChatSettingsDialog';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { useIsMobile, useIsMobileOrTablet } from '@/hooks/use-mobile';
import { ArrowLeft, MessageSquarePlus, Users, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Chat() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isMobileOrTablet = useIsMobileOrTablet();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
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

  // Enable chat notifications
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

  // Mobile/Tablet: Show only list or thread
  if (isMobileOrTablet) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <FacebookNavbar />
        
        <main className="flex-1 pt-14 pb-20">
          {conversationId ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-2 p-3 border-b bg-card">
                <Button variant="ghost" size="icon" onClick={handleBack}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <span className="font-medium">Tin nhắn</span>
              </div>
              <MessageThread
                conversationId={conversationId}
                userId={userId}
                username={username}
              />
            </div>
          ) : (
            <div className="h-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h1 className="text-xl font-bold">Tin nhắn</h1>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSettings(true)}
                    className="border border-transparent hover:border-gold/40 rounded-full"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="border border-transparent hover:border-gold/40 rounded-full">
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
              <ConversationList
                conversations={conversations}
                selectedId={null}
                currentUserId={userId}
                onSelect={handleSelectConversation}
                isLoading={isLoading}
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

        <ChatSettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
          userId={userId}
        />
      </div>
    );
  }

  // Desktop: Two-column layout
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <FacebookNavbar />
      
      <main className="flex-1 pt-14 flex">
        {/* Left sidebar - Conversation list */}
        <div className="w-80 border-r bg-card flex flex-col h-[calc(100vh-3.5rem)]">
          <div className="flex items-center justify-between p-4 border-b">
            <h1 className="text-xl font-bold">Tin nhắn</h1>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                className="border border-transparent hover:border-gold/40 rounded-full"
              >
                <Settings className="h-5 w-5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="border border-transparent hover:border-gold/40 rounded-full">
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
          <ConversationList
            conversations={conversations}
            selectedId={conversationId || null}
            currentUserId={userId}
            onSelect={handleSelectConversation}
            isLoading={isLoading}
          />
        </div>

        {/* Main content - Message thread */}
        <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)]">
          {conversationId ? (
            <MessageThread
              conversationId={conversationId}
              userId={userId}
              username={username}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquarePlus className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Chọn cuộc trò chuyện để bắt đầu</p>
              </div>
            </div>
          )}
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

      <ChatSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        userId={userId}
      />
    </div>
  );
}
