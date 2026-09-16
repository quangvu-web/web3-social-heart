import { Bell, Heart, MessageCircle, Share2, Gift, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useIsMobileOrTablet } from '@/hooks/use-mobile';

interface Notification {
  id: string;
  type: string;
  read: boolean;
  created_at: string;
  post_id: string | null;
  actor: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

const REACTION_ICONS: Record<string, { icon: string; color: string }> = {
  like: { icon: '👍', color: 'text-blue-500' },
  love: { icon: '❤️', color: 'text-red-500' },
  haha: { icon: '😂', color: 'text-yellow-500' },
  wow: { icon: '😮', color: 'text-yellow-500' },
  sad: { icon: '😢', color: 'text-yellow-500' },
  angry: { icon: '😠', color: 'text-orange-500' },
};

interface NotificationDropdownProps {
  centerNavStyle?: boolean;
  isActiveRoute?: boolean;
}

export const NotificationDropdown = ({ centerNavStyle = false, isActiveRoute = false }: NotificationDropdownProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const isMobileOrTablet = useIsMobileOrTablet();

  const fetchNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setCurrentUserId(user.id);

    const { data } = await supabase
      .from('notifications')
      .select(`
        id,
        type,
        read,
        created_at,
        post_id,
        actor:actor_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (data) {
      setNotifications(data as any);
      const newUnreadCount = data.filter(n => !n.read).length;
      
      // Trigger golden glow animation when new notifications arrive
      if (newUnreadCount > unreadCount) {
        setHasNewNotification(true);
        setTimeout(() => setHasNewNotification(false), 3000);
      }
      
      setUnreadCount(newUnreadCount);
    }
  }, [unreadCount]);

  useEffect(() => {
    fetchNotifications();

    // Get current user for real-time filter
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Subscribe to real-time notifications for this user
      const channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            fetchNotifications();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtime();
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    
    fetchNotifications();
  };

  const markAllAsRead = async () => {
    if (!currentUserId) return;
    
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', currentUserId)
      .eq('read', false);
    
    fetchNotifications();
  };

  const handleNotificationClick = async (notification: Notification) => {
    await markAsRead(notification.id);
    setOpen(false);
    
    if (notification.post_id) {
      navigate(`/post/${notification.post_id}`);
    } else if (notification.type === 'friend_request' || notification.type === 'friend_accepted') {
      navigate(`/profile/${notification.actor?.id}`);
    } else if (notification.type === 'reward_approved' || notification.type === 'reward_rejected') {
      navigate('/wallet');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <span className="text-lg">{REACTION_ICONS.like.icon}</span>;
      case 'love':
        return <span className="text-lg">{REACTION_ICONS.love.icon}</span>;
      case 'haha':
        return <span className="text-lg">{REACTION_ICONS.haha.icon}</span>;
      case 'wow':
        return <span className="text-lg">{REACTION_ICONS.wow.icon}</span>;
      case 'sad':
        return <span className="text-lg">{REACTION_ICONS.sad.icon}</span>;
      case 'angry':
        return <span className="text-lg">{REACTION_ICONS.angry.icon}</span>;
      case 'comment':
      case 'comment_like':
        return <MessageCircle className="w-4 h-4 text-primary" />;
      case 'share':
        return <Share2 className="w-4 h-4 text-green-500" />;
      case 'reward_approved':
      case 'reward_rejected':
        return <Gift className="w-4 h-4 text-gold" />;
      case 'account_banned':
        return <Shield className="w-4 h-4 text-destructive" />;
      case 'friend_request':
      case 'friend_accepted':
        return <Heart className="w-4 h-4 text-pink-500" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getNotificationText = (type: string, username: string) => {
    switch (type) {
      case 'like':
        return <><strong>{username}</strong> đã thích bài viết của bạn</>;
      case 'love':
        return <><strong>{username}</strong> đã yêu thích bài viết của bạn</>;
      case 'haha':
        return <><strong>{username}</strong> đã cười với bài viết của bạn</>;
      case 'wow':
        return <><strong>{username}</strong> đã ngạc nhiên với bài viết của bạn</>;
      case 'sad':
        return <><strong>{username}</strong> đã buồn với bài viết của bạn</>;
      case 'angry':
        return <><strong>{username}</strong> đã tức giận với bài viết của bạn</>;
      case 'comment':
        return <><strong>{username}</strong> đã bình luận bài viết của bạn</>;
      case 'comment_like':
        return <><strong>{username}</strong> đã thích bình luận của bạn</>;
      case 'share':
        return <><strong>{username}</strong> đã chia sẻ bài viết của bạn</>;
      case 'reward_approved':
        return <>🎉 <strong>Chúc mừng!</strong> Phần thưởng của bạn đã được duyệt</>;
      case 'reward_rejected':
        return <>📋 Yêu cầu nhận thưởng cần được xem xét lại</>;
      case 'account_banned':
        return <>⚠️ Tài khoản của bạn đã bị hạn chế</>;
      case 'friend_request':
        return <><strong>{username}</strong> đã gửi lời mời kết bạn</>;
      case 'friend_accepted':
        return <><strong>{username}</strong> đã chấp nhận lời mời kết bạn</>;
      default:
        return <><strong>{username}</strong> đã tương tác với bạn</>;
    }
  };

  // Mobile/Tablet: Navigate directly to notifications page
  const handleBellClick = () => {
    if (isMobileOrTablet) {
      navigate('/notifications');
    }
  };

  // On mobile/tablet, render a simple button that navigates to notifications page
  if (isMobileOrTablet) {
    return (
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={handleBellClick}
        className={cn(
          "h-10 w-10 relative transition-all duration-300 group",
          "text-foreground hover:text-primary hover:bg-primary/10",
          hasNewNotification && "animate-pulse"
        )} 
        aria-label="Thông báo"
      >
        <Bell className={cn(
          "w-5 h-5 transition-all duration-300",
          "group-hover:drop-shadow-[0_0_6px_hsl(142_76%_36%/0.5)]",
          hasNewNotification && "animate-bounce drop-shadow-[0_0_8px_hsl(48_96%_53%/0.6)]"
        )} />
        {unreadCount > 0 && (
          <span className={cn(
            "absolute -top-0.5 -right-0.5 text-xs rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center font-bold transition-all duration-300",
            hasNewNotification 
              ? "bg-gold text-black shadow-[0_0_15px_hsl(var(--gold-glow))] animate-pulse scale-110" 
              : "bg-primary text-primary-foreground"
          )}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>
    );
  }

  // Desktop: Show popover dropdown
  // If centerNavStyle is true, use the same styling as other nav items
  if (centerNavStyle) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex-1 h-full max-w-[100px] flex items-center justify-center relative transition-all duration-300 rounded-lg group",
              isActiveRoute
                ? 'text-primary-foreground bg-primary'
                : 'text-foreground hover:text-primary hover:bg-primary/10'
            )}
            aria-label="Thông báo"
          >
            <Bell className={cn(
              "w-6 h-6 transition-all duration-300",
              !isActiveRoute && "group-hover:drop-shadow-[0_0_6px_hsl(142_76%_36%/0.5)]"
            )} />
            {unreadCount > 0 && (
              <span className={cn(
                "absolute top-1 right-2 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold transition-all duration-300",
                hasNewNotification 
                  ? "bg-gold text-black shadow-[0_0_15px_hsl(var(--gold-glow))] animate-pulse scale-110" 
                  : "bg-destructive text-destructive-foreground"
              )}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            {isActiveRoute && (
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-gold to-primary rounded-t-full" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 sm:w-96 lg:w-[450px] p-0 border-gold/20 shadow-[0_0_20px_hsl(var(--gold-glow)/0.2)]" 
          align="end"
          sideOffset={8}
        >
          <div className="flex items-center justify-between p-4 border-b border-border/50 bg-gradient-to-r from-gold/5 to-transparent">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-gold" />
              Thông báo
            </h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs text-gold hover:text-gold/80 hover:underline transition-colors"
              >
                Đánh dấu đã đọc ({unreadCount})
              </button>
            )}
          </div>
          <ScrollArea className="h-[400px] sm:h-[500px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Chưa có thông báo nào</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "w-full p-3 sm:p-4 flex items-start gap-3 hover:bg-muted/50 transition-all duration-200 border-b border-border/30 text-left",
                    !notification.read && "bg-gradient-to-r from-gold/10 via-gold/5 to-transparent shadow-[inset_0_0_20px_hsl(var(--gold-glow)/0.1)]"
                  )}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className={cn(
                      "w-10 h-10 sm:w-12 sm:h-12 border-2 transition-all",
                      !notification.read ? "border-gold/50 shadow-[0_0_10px_hsl(var(--gold-glow)/0.3)]" : "border-transparent"
                    )}>
                      {notification.actor?.avatar_url && (
                        <AvatarImage src={notification.actor.avatar_url} />
                      )}
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {notification.actor?.username?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-card rounded-full flex items-center justify-center border border-border shadow-sm">
                      {getNotificationIcon(notification.type)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm leading-relaxed",
                      !notification.read ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {getNotificationText(notification.type, notification.actor?.username || 'Người dùng')}
                    </p>
                    <p className={cn(
                      "text-xs mt-1",
                      !notification.read ? "text-gold" : "text-muted-foreground"
                    )}>
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: vi
                      })}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2.5 h-2.5 bg-gold rounded-full flex-shrink-0 mt-2 shadow-[0_0_8px_hsl(var(--gold-glow))] animate-pulse" />
                  )}
                </button>
              ))
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "h-14 w-14 relative transition-all duration-300 group",
            "text-foreground hover:text-primary hover:bg-primary/10",
            hasNewNotification && "animate-pulse"
          )} 
          aria-label="Thông báo"
        >
          <Bell className={cn(
            "w-7 h-7 transition-all duration-300",
            "group-hover:drop-shadow-[0_0_6px_hsl(142_76%_36%/0.5)]",
            hasNewNotification && "animate-bounce"
          )} />
          {unreadCount > 0 && (
            <span className={cn(
              "absolute -top-1 -right-1 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold transition-all duration-300",
              hasNewNotification 
                ? "bg-primary text-primary-foreground shadow-[0_0_15px_hsl(142_76%_36%/0.5)] animate-pulse scale-110" 
                : "bg-primary text-primary-foreground"
            )}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 lg:w-[450px] p-0 border-border/20 shadow-lg" align="end" sideOffset={8}>
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-gradient-to-r from-gold/5 to-transparent">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Bell className="w-4 h-4 text-gold" />
            Thông báo
          </h3>
          {unreadCount > 0 && (
            <button 
              onClick={markAllAsRead}
              className="text-xs text-gold hover:text-gold/80 hover:underline transition-colors"
            >
              Đánh dấu đã đọc ({unreadCount})
            </button>
          )}
        </div>
        <ScrollArea className="h-[400px] sm:h-[500px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Chưa có thông báo nào</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  "w-full p-3 sm:p-4 flex items-start gap-3 hover:bg-muted/50 transition-all duration-200 border-b border-border/30 text-left",
                  !notification.read && "bg-gradient-to-r from-gold/10 via-gold/5 to-transparent shadow-[inset_0_0_20px_hsl(var(--gold-glow)/0.1)]"
                )}
              >
                <div className="relative flex-shrink-0">
                  <Avatar className={cn(
                    "w-10 h-10 sm:w-12 sm:h-12 border-2 transition-all",
                    !notification.read ? "border-gold/50 shadow-[0_0_10px_hsl(var(--gold-glow)/0.3)]" : "border-transparent"
                  )}>
                    {notification.actor?.avatar_url && (
                      <AvatarImage src={notification.actor.avatar_url} />
                    )}
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {notification.actor?.username?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-card rounded-full flex items-center justify-center border border-border shadow-sm">
                    {getNotificationIcon(notification.type)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm leading-relaxed",
                    !notification.read ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {getNotificationText(notification.type, notification.actor?.username || 'Người dùng')}
                  </p>
                  <p className={cn(
                    "text-xs mt-1",
                    !notification.read ? "text-gold" : "text-muted-foreground"
                  )}>
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: vi
                    })}
                  </p>
                </div>
                {!notification.read && (
                  <div className="w-2.5 h-2.5 bg-gold rounded-full flex-shrink-0 mt-2 shadow-[0_0_8px_hsl(var(--gold-glow))] animate-pulse" />
                )}
              </button>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
