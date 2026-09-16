import { useState } from 'react';
import { ReactionViewerDialog } from './ReactionViewerDialog';
import { useLanguage } from '@/i18n/LanguageContext';

interface ReactionCount {
  type: string;
  count: number;
}

interface ReactionSummaryProps {
  postId: string;
  reactions: ReactionCount[];
  totalCount: number;
  commentCount: number;
  shareCount: number;
  onCommentClick: () => void;
}

const REACTION_ICONS: Record<string, { icon: string; bgColor: string }> = {
  like: { icon: '👍', bgColor: 'bg-blue-500' },
  love: { icon: '❤️', bgColor: 'bg-red-500' },
  care: { icon: '🥰', bgColor: 'bg-orange-500' },
  haha: { icon: '😂', bgColor: 'bg-yellow-500' },
  wow: { icon: '😮', bgColor: 'bg-yellow-500' },
  pray: { icon: '🙏', bgColor: 'bg-purple-500' },
  sad: { icon: '😢', bgColor: 'bg-yellow-500' },
  angry: { icon: '😠', bgColor: 'bg-orange-500' },
};

export const ReactionSummary = ({
  postId,
  reactions,
  totalCount,
  commentCount,
  shareCount,
  onCommentClick,
}: ReactionSummaryProps) => {
  const [showViewerDialog, setShowViewerDialog] = useState(false);
  const { t } = useLanguage();
  if (totalCount === 0 && commentCount === 0 && shareCount === 0) {
    return null;
  }

  // Get top 3 reactions by count
  const sortedReactions = [...reactions]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .filter((r) => r.count > 0);

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          {totalCount > 0 && (
            <button
              onClick={() => setShowViewerDialog(true)}
              className="flex items-center gap-1 hover:underline"
            >
              <div className="flex -space-x-1">
                {sortedReactions.map((reaction, index) => {
                  const reactionInfo = REACTION_ICONS[reaction.type];
                  if (!reactionInfo) return null;
                  return (
                    <span
                      key={reaction.type}
                      className={`w-5 h-5 rounded-full ${reactionInfo.bgColor} flex items-center justify-center text-xs border-2 border-card`}
                      style={{ zIndex: 3 - index }}
                    >
                      {reactionInfo.icon}
                    </span>
                  );
                })}
              </div>
              <span className="ml-1">{totalCount}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {commentCount > 0 && (
            <button onClick={onCommentClick} className="hover:underline">
              {commentCount} {t('comments')}
            </button>
          )}
          {shareCount > 0 && (
            <span className="hover:underline cursor-pointer">
              {shareCount} {t('shares')}
            </span>
          )}
        </div>
      </div>

      <ReactionViewerDialog
        open={showViewerDialog}
        onOpenChange={setShowViewerDialog}
        postId={postId}
        reactions={reactions}
        totalCount={totalCount}
      />
    </>
  );
};
