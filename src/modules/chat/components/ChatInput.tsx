import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Paperclip, Send, X, Gift, Wallet, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadCommentMedia } from '@/utils/mediaUpload';
import { toast } from 'sonner';
import { EmojiPicker } from '@/components/feed/EmojiPicker';
import { SendCryptoModal } from './SendCryptoModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { rewriteChatAttachmentUrl } from '@/lib/urlFix';
import type { Message } from '../types';
import type { Sticker } from '../types';
import { StickerPicker } from './StickerPicker';
import { RedEnvelopeDialog } from './RedEnvelopeDialog';

interface ChatInputProps {
  onSend: (content: string, mediaUrls?: string[]) => Promise<void>;
  onSendSticker?: (sticker: Sticker) => Promise<void>;
  onCreateRedEnvelope?: (input: { token: 'CAMLY' | 'BNB'; totalAmount: number; totalCount: number }) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  replyTo: Message | null;
  onCancelReply: () => void;
  isSending: boolean;
  recipientWalletAddress?: string | null;
  recipientUserId?: string | null;
  recipientName?: string | null;
  recipientAvatar?: string | null;
  conversationId?: string | null;
  isGroup?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export function ChatInput({
  onSend,
  onSendSticker,
  onCreateRedEnvelope,
  onTyping,
  replyTo,
  onCancelReply,
  isSending,
  recipientWalletAddress,
  recipientUserId,
  recipientName,
  recipientAvatar,
  conversationId,
  isGroup = false,
  disabled = false,
  disabledReason,
}: ChatInputProps) {
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showRedEnvelope, setShowRedEnvelope] = useState(false);
  const [isCreatingEnvelope, setIsCreatingEnvelope] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isImageFile = (file: File | undefined) => {
    if (!file) return false;
    if (file.type.startsWith('image/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic'].includes(ext || '');
  };

  const isVideoFile = (file: File | undefined) => {
    if (!file) return false;
    if (file.type.startsWith('video/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ['mp4', 'webm', 'mov', 'm4v'].includes(ext || '');
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    onTyping(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 4 files
    const newFiles = files.slice(0, 4 - mediaFiles.length);
    if (files.length > newFiles.length) {
      toast.warning('Tối đa 4 file mỗi tin nhắn');
    }

    // Create previews for images/videos only
    const newPreviews = newFiles.map((file) =>
      isImageFile(file) || isVideoFile(file)
        ? URL.createObjectURL(file)
        : ''
    );
    
    setMediaFiles((prev) => [...prev, ...newFiles]);
    setMediaPreviews((prev) => [...prev, ...newPreviews]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeMedia = (index: number) => {
    if (mediaPreviews[index]) {
      URL.revokeObjectURL(mediaPreviews[index]);
    }
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent && mediaFiles.length === 0) return;

    try {
      setIsUploading(true);

      // Upload media files
      let uploadedUrls: string[] = [];
      if (mediaFiles.length > 0) {
        const uploadPromises = mediaFiles.map((file) => uploadCommentMedia(file));
        const results = await Promise.all(uploadPromises);
        uploadedUrls = results.map((r) => rewriteChatAttachmentUrl(r.url));
      }

      await onSend(trimmedContent, uploadedUrls.length > 0 ? uploadedUrls : undefined);

      // Clear input
      setContent('');
      setMediaFiles([]);
      mediaPreviews.forEach((url) => URL.revokeObjectURL(url));
      setMediaPreviews([]);
      onTyping(false);

    } catch (error) {
      console.error('Error sending message:', error);
      if (error instanceof Error && error.message === 'FILE_TYPE_NOT_SUPPORTED') {
        toast.error('File này chưa được hỗ trợ hoặc thiếu MIME. Vui lòng thử lại hoặc đổi định dạng.');
      } else {
        toast.error('Không thể gửi tin nhắn');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = useCallback((emoji: string) => {
    setContent((prev) => prev + emoji);
    textareaRef.current?.focus();
  }, []);

  const isDisabled = isSending || isUploading;
  const canSend = (content.trim() || mediaFiles.length > 0) && !isDisabled && !disabled;

  return (
    <div className="border-t bg-card p-3">
      {disabled && disabledReason && (
        <div className="mb-2 text-xs text-destructive">{disabledReason}</div>
      )}
      {!isGroup && !recipientWalletAddress && (
        <div className="mb-2 text-xs text-muted-foreground">
          Người dùng chưa cập nhật ví Web3. Không thể tặng tiền.
        </div>
      )}
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-muted rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              Trả lời {replyTo.sender?.username}
            </p>
            <p className="text-sm truncate">{replyTo.content}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancelReply}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Media previews */}
      {mediaPreviews.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
          {mediaPreviews.map((preview, index) => {
            const file = mediaFiles[index];
            const isImage = isImageFile(file);
            const isVideo = isVideoFile(file);
            return (
              <div key={index} className="relative flex-shrink-0">
                {isImage && preview ? (
                  <img
                    src={preview}
                    alt=""
                    className="h-16 w-16 object-cover rounded-lg"
                  />
                ) : isVideo && preview ? (
                  <video
                    src={preview}
                    className="h-16 w-16 object-cover rounded-lg"
                    muted
                    playsInline
                  />
                ) : (
                  <div className="h-16 w-32 rounded-lg border bg-muted flex items-center gap-2 px-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs truncate">{file?.name || 'File'}</span>
                  </div>
                )}
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full"
                  onClick={() => removeMedia(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.apk"
          multiple
          className="hidden"
        />

        {/* Attach menu popup (Paperclip) */}
        <Popover open={showAttachMenu} onOpenChange={setShowAttachMenu}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 border border-[#C9A84C]/30 hover:border-[#C9A84C]/60 rounded-full"
              disabled={isDisabled || disabled}
              title="Đính kèm"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-52 p-1">
            <div className="flex flex-col">
              {/* Đính kèm file */}
              <button
                onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }}
                disabled={mediaFiles.length >= 4}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent text-sm text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                Đính kèm file
              </button>

              {/* Stickers */}
              <button
                onClick={() => { setShowAttachMenu(false); setTimeout(() => setShowStickerPicker(true), 100); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent text-sm text-left"
              >
                <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                Stickers
              </button>

              {/* Lì xì */}
              <button
                onClick={() => { setShowRedEnvelope(true); setShowAttachMenu(false); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent text-sm text-left"
              >
                <Gift className="h-4 w-4 text-[#C9A84C] flex-shrink-0" />
                Lì xì
              </button>

              {/* Crypto Gift — chỉ hiện khi không phải group */}
              {!isGroup && (
                <button
                  onClick={() => { setShowCryptoModal(true); setShowAttachMenu(false); }}
                  disabled={!recipientWalletAddress}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent text-sm text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wallet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  Crypto Gift
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <EmojiPicker onEmojiSelect={handleEmojiSelect} />

        {/* StickerPicker controlled từ state */}
        <StickerPicker
          open={showStickerPicker}
          onOpenChange={setShowStickerPicker}
          disabled={isDisabled || disabled}
          onSelect={async (sticker) => {
            if (!onSendSticker) return;
            await onSendSticker(sticker);
            setShowStickerPicker(false);
          }}
        />

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder="Nhập tin nhắn..."
          className="min-h-[40px] max-h-[120px] resize-none flex-1"
          rows={1}
          disabled={isDisabled || disabled}
        />

        <Button
          size="icon"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            'flex-shrink-0 transition-colors',
            canSend && 'bg-primary hover:bg-primary/90'
          )}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>

      <RedEnvelopeDialog
        open={showRedEnvelope}
        onOpenChange={setShowRedEnvelope}
        isCreating={isCreatingEnvelope}
        onCreate={async (input) => {
          if (!onCreateRedEnvelope) return;
          try {
            setIsCreatingEnvelope(true);
            await onCreateRedEnvelope(input);
            setShowRedEnvelope(false);
          } finally {
            setIsCreatingEnvelope(false);
          }
        }}
      />

      <SendCryptoModal
        open={showCryptoModal}
        onOpenChange={setShowCryptoModal}
        recipientAddress={recipientWalletAddress}
        recipientUserId={recipientUserId}
        recipientName={recipientName}
        recipientAvatar={recipientAvatar}
        conversationId={conversationId}
      />
    </div>
  );
}



