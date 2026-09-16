import { useState, useRef, useCallback, memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LazyImage } from '@/components/ui/LazyImage';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { FileText, Reply, SmilePlus, Check, CheckCheck, MoreHorizontal, Pin, PinOff, Pencil, Trash2, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { R2_NEW_PUBLIC_URL, rewriteChatAttachmentUrl } from '@/lib/urlFix';
import type { Message } from '../types';
import { RedEnvelopeCard } from './RedEnvelopeCard';

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'];
interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  currentUserId: string | null;
  onReply: () => void;
  onReaction: (emoji: string, hasReacted: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onTogglePin?: () => void;
  onReport?: () => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  showAvatar,
  currentUserId,
  onReply,
  onReaction,
  onEdit,
  onDelete,
  onTogglePin,
  onReport,
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = useCallback(() => {
    longPressRef.current = setTimeout(() => {
      setShowActions(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);
  const mediaUrls = Array.isArray(message.media_urls) ? message.media_urls as string[] : [];
  const normalizedMediaUrls = mediaUrls.map((url) => rewriteChatAttachmentUrl(url));

  const getExtension = (url: string) => {
    try {
      const pathname = new URL(url).pathname;
      const name = pathname.split('/').pop() || '';
      const ext = name.split('.').pop() || '';
      return ext.toLowerCase();
    } catch {
      const name = url.split('?')[0].split('#')[0].split('/').pop() || '';
      return name.split('.').pop()?.toLowerCase() || '';
    }
  };

  const isImageUrl = (url: string) => {
    const ext = getExtension(url);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic'].includes(ext);
  };

  const isVideoUrl = (url: string) => {
    const ext = getExtension(url);
    return ['mp4', 'webm', 'mov', 'm4v'].includes(ext);
  };

  const getFilename = (url: string) => {
    try {
      const pathname = new URL(url).pathname;
      return decodeURIComponent(pathname.split('/').pop() || 'file');
    } catch {
      return decodeURIComponent(url.split('?')[0].split('#')[0].split('/').pop() || 'file');
    }
  };
  
  // Group reactions by emoji
  const reactionCounts = message.reactions?.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const userReactions = message.reactions
    ?.filter((r) => r.user_id === currentUserId)
    .map((r) => r.emoji) || [];

  const isRead = message.read_by && message.read_by.length > 0;
  const isPinned = !!message.pinned_at;
  const isDeleted = !!message.is_deleted;
  const messageType = (message.message_type || 'text') as string;
  const metadata: any = message.metadata && typeof message.metadata === 'object' ? message.metadata : {};

  const createdAt = message.created_at ? new Date(message.created_at) : null;
  const canEditByTime = createdAt ? (Date.now() - createdAt.getTime()) <= 15 * 60 * 1000 : false;
  const canEdit = isOwn && !isDeleted && messageType === 'text' && canEditByTime;

  return (
    <div
      className={cn('flex gap-2 group', isOwn ? 'flex-row-reverse' : '')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Avatar */}
      <div className="w-8 flex-shrink-0">
        {showAvatar && !isOwn && message.sender && (
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={message.sender.avatar_url || undefined}
              alt={message.sender.username}
            />
            <AvatarFallback>
              {message.sender.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Message content */}
      <div className={cn('flex flex-col max-w-[70%]', isOwn ? 'items-end' : 'items-start')}>
        {/* Reply preview */}
        {message.reply_to && (
          <div className={cn(
            'text-xs px-3 py-1 rounded-t-lg bg-muted/50 border-l-2',
            isOwn ? 'border-primary' : 'border-muted-foreground'
          )}>
            <span className="text-muted-foreground">
              Trả lời {message.reply_to.sender?.username || 'tin nhắn'}
            </span>
            <p className="truncate">{message.reply_to.content}</p>
          </div>
        )}

        {/* Bubble */}
        <div
          className={cn(
            'px-4 py-2 rounded-2xl relative',
            messageType === 'system'
              ? 'bg-amber-50 text-foreground border border-amber-200'
              : isOwn
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-muted rounded-bl-md',
            message.reply_to && 'rounded-t-none'
          )}
        >
          {isDeleted ? (
            <p className="text-sm italic opacity-80">Tin nhắn đã được thu hồi / xóa</p>
          ) : messageType === 'sticker' ? (
            <div className="flex flex-col items-center">
              <img
                src={metadata?.sticker?.url || metadata?.stickerUrl || ''}
                alt={metadata?.sticker?.name || 'sticker'}
                className="w-32 h-32 object-contain"
              />
            </div>
          ) : messageType === 'red_envelope' ? (
            (metadata?.envelopeId || metadata?.envelope_id) ? (
              <RedEnvelopeCard
                envelopeId={metadata?.envelopeId || metadata?.envelope_id}
                conversationId={message.conversation_id}
                currentUserId={currentUserId}
                compact
              />
            ) : (
              <p className="text-sm">[Red Envelope]</p>
            )
          ) : (
            <>
              {/* Text content */}
              {message.content && (
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              )}

              {/* Media */}
              {normalizedMediaUrls.length > 0 && (
                <div className={cn('mt-2 grid gap-1', normalizedMediaUrls.length > 1 ? 'grid-cols-2' : '')}>
                  {normalizedMediaUrls.map((url, i) => {
                    if (isImageUrl(url)) {
                      const skipTransform = url.startsWith(R2_NEW_PUBLIC_URL);
                      return (
                        <LazyImage
                          key={i}
                          src={url}
                          alt=""
                          skipTransform={skipTransform}
                          className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90"
                        />
                      );
                    }

                    if (isVideoUrl(url)) {
                      return (
                        <video
                          key={i}
                          src={url}
                          controls
                          playsInline
                          preload="metadata"
                          className="rounded-lg max-w-full h-auto"
                        />
                      );
                    }

                    const filename = getFilename(url);
                    return (
                      <div key={i} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm truncate">{filename}</div>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            download
                            className="text-xs text-primary hover:underline"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Reactions display */}
          {Object.keys(reactionCounts).length > 0 && (
            <div className={cn(
              'absolute -bottom-3 flex gap-0.5 bg-card rounded-full px-1 py-0.5 shadow-sm border',
              isOwn ? 'right-2' : 'left-2'
            )}>
              {Object.entries(reactionCounts).map(([emoji, count]) => (
                <span key={emoji} className="text-xs">
                  {emoji}{count > 1 && <span className="text-muted-foreground">{count}</span>}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Timestamp & read status */}
        <div className="flex items-center gap-1 mt-1 px-2">
          <span className="text-[10px] text-muted-foreground">
            {message.created_at && format(new Date(message.created_at), 'HH:mm', { locale: vi })}
          </span>
          {!isDeleted && message.edited_at && (
            <span className="text-[10px] text-muted-foreground">(đã sửa)</span>
          )}
          {!isDeleted && isPinned && (
            <span className="text-[10px] text-muted-foreground">(ghim)</span>
          )}
          {isOwn && (
            <span className="text-muted-foreground">
              {isRead ? (
                <CheckCheck className="h-3 w-3 text-primary" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div
        className={cn(
          'flex items-center gap-1 opacity-0 transition-opacity',
          showActions && 'opacity-100'
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onReply}
            >
              <Reply className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Trả lời</TooltipContent>
        </Tooltip>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <SmilePlus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" side="top">
            <div className="flex gap-1">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onReaction(emoji, userReactions.includes(emoji))}
                  className={cn(
                    'text-xl p-1 rounded hover:bg-accent transition-colors',
                    userReactions.includes(emoji) && 'bg-accent'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
            <DropdownMenuItem onClick={onTogglePin} disabled={!onTogglePin}>
              {isPinned ? <PinOff className="h-4 w-4 mr-2" /> : <Pin className="h-4 w-4 mr-2" />}
              {isPinned ? 'Bỏ ghim' : 'Ghim tin nhắn'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEdit} disabled={!canEdit || !onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Sửa tin nhắn
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} disabled={!isOwn || isDeleted || !onDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Thu hồi / Xóa
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onReport} disabled={!onReport}>
              <Flag className="h-4 w-4 mr-2" />
              Gửi phản hồi
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});

