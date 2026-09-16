/**
 * Feed Module
 * Manages all feed, post, comment, and reaction functionality
 */

// Pages
export { default as FeedPage } from './pages/Feed';
export { default as PostPage } from './pages/Post';

// Post Components
export { FacebookPostCard } from './components/post/FacebookPostCard';
export { FacebookCreatePost } from './components/post/FacebookCreatePost';
export { EditPostDialog } from './components/post/EditPostDialog';
export { MediaGrid } from './components/post/MediaGrid';
export { ExpandableContent } from './components/post/ExpandableContent';
export { PrivacySelector } from './components/post/PrivacySelector';
export { MediaUploadPreview } from './components/post/MediaUploadPreview';
export { VideoUploadProgress } from './components/post/VideoUploadProgress';
export { VideoUploaderUppy } from './components/post/VideoUploaderUppy';

// Reaction Components
export { ReactionButton } from './components/reaction/ReactionButton';
export { ReactionSummary } from './components/reaction/ReactionSummary';
export { ReactionViewerDialog } from './components/reaction/ReactionViewerDialog';

// Comment Components
export { CommentSection } from './components/comment/CommentSection';
export { CommentItem } from './components/comment/CommentItem';
export { CommentReplyForm } from './components/comment/CommentReplyForm';
export { CommentMediaUpload } from './components/comment/CommentMediaUpload';
export { CommentMediaViewer } from './components/comment/CommentMediaViewer';
export { CommentReactionButton } from './components/comment/CommentReactionButton';
export { EmojiPicker } from './components/comment/EmojiPicker';

// Sidebar Components
export { FacebookLeftSidebar } from './components/sidebar/FacebookLeftSidebar';
export { FacebookRightSidebar } from './components/sidebar/FacebookRightSidebar';
export { StoriesBar } from './components/sidebar/StoriesBar';
export { AppHonorBoard } from './components/sidebar/AppHonorBoard';
export { TopRanking } from './components/sidebar/TopRanking';

// Dialog Components
export { FeelingActivityDialog } from './components/dialog/FeelingActivityDialog';
export { FriendTagDialog } from './components/dialog/FriendTagDialog';
export { LocationCheckin } from './components/dialog/LocationCheckin';
export { ImageViewer } from './components/dialog/ImageViewer';

// Hooks
export { useFeedPosts } from './hooks/useFeedPosts';

// Types
export type {
  Post,
  PostProfile,
  MediaItem,
  PostReaction,
  PostStats,
  FeedPost,
  ReactionCount,
  ReactionType,
  Comment,
  FeelingActivity,
  TaggedFriend,
  VideoUploadState,
  PrivacyOption,
} from './types';
