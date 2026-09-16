import { useState } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FeelingActivity } from '../../types';

// Danh sách cảm xúc theo Facebook
const FEELINGS = [
  { emoji: '😊', text: 'hạnh phúc' },
  { emoji: '🥰', text: 'có phúc' },
  { emoji: '😍', text: 'được yêu' },
  { emoji: '😢', text: 'buồn' },
  { emoji: '🥺', text: 'đáng yêu' },
  { emoji: '🙏', text: 'biết ơn' },
  { emoji: '🤩', text: 'hào hứng' },
  { emoji: '💕', text: 'đang yêu' },
  { emoji: '🤪', text: 'điên' },
  { emoji: '😲', text: 'cảm kích' },
  { emoji: '😄', text: 'sung sướng' },
  { emoji: '✨', text: 'tuyệt vời' },
  { emoji: '😌', text: 'thư thái' },
  { emoji: '💪', text: 'mạnh mẽ' },
  { emoji: '🎉', text: 'phấn khích' },
  { emoji: '😴', text: 'mệt mỏi' },
  { emoji: '😤', text: 'tức giận' },
  { emoji: '🤔', text: 'suy nghĩ' },
  { emoji: '😎', text: 'cool' },
  { emoji: '🥳', text: 'vui vẻ' },
  { emoji: '😇', text: 'may mắn' },
  { emoji: '🤗', text: 'ấm áp' },
  { emoji: '😋', text: 'ngon miệng' },
  { emoji: '🥱', text: 'buồn ngủ' },
];

const ACTIVITIES = [
  { emoji: '🎉', text: 'Đang ăn mừng' },
  { emoji: '👀', text: 'Đang xem' },
  { emoji: '🎮', text: 'Đang chơi' },
  { emoji: '🎧', text: 'Đang nghe' },
  { emoji: '🍽️', text: 'Đang ăn' },
  { emoji: '☕', text: 'Đang uống' },
  { emoji: '✈️', text: 'Đang đi đến' },
  { emoji: '📚', text: 'Đang đọc' },
  { emoji: '💼', text: 'Đang làm việc' },
  { emoji: '🏃', text: 'Đang tập thể dục' },
  { emoji: '🛒', text: 'Đang mua sắm' },
  { emoji: '🎬', text: 'Đang xem phim' },
  { emoji: '🎤', text: 'Đang hát' },
  { emoji: '💻', text: 'Đang code' },
  { emoji: '🎨', text: 'Đang vẽ' },
  { emoji: '📝', text: 'Đang viết' },
  { emoji: '🧘', text: 'Đang thiền' },
  { emoji: '🎸', text: 'Đang chơi nhạc' },
  { emoji: '🏠', text: 'Đang ở nhà' },
  { emoji: '🌙', text: 'Đang ngủ' },
];

interface FeelingActivityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (feeling: FeelingActivity) => void;
}

export const FeelingActivityDialog = ({ isOpen, onClose, onSelect }: FeelingActivityDialogProps) => {
  const [activeTab, setActiveTab] = useState<'feeling' | 'activity'>('feeling');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = activeTab === 'feeling'
    ? FEELINGS.filter(f => f.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : ACTIVITIES.filter(a => a.text.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSelect = (item: { emoji: string; text: string }) => {
    onSelect({ ...item, type: activeTab });
    setSearchQuery('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] p-0 max-h-[80vh] flex flex-col z-[200]">
        <DialogHeader className="p-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-secondary rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <DialogTitle className="flex-1 text-center font-bold pr-9">
              Bạn đang cảm thấy thế nào?
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          <button
            className={`flex-1 py-3 font-semibold transition-colors ${
              activeTab === 'feeling'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:bg-muted/50'
            }`}
            onClick={() => setActiveTab('feeling')}
          >
            Cảm xúc
          </button>
          <button
            className={`flex-1 py-3 font-semibold transition-colors ${
              activeTab === 'activity'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:bg-muted/50'
            }`}
            onClick={() => setActiveTab('activity')}
          >
            Hoạt động
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-full">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              placeholder="Tìm kiếm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none flex-1 text-sm"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-1 p-3 overflow-y-auto flex-1">
          {filteredItems.map((item, index) => (
            <button
              key={`${item.emoji}-${index}`}
              onClick={() => handleSelect(item)}
              className="flex items-center gap-3 p-3 hover:bg-secondary rounded-lg transition-colors text-left"
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-sm">{item.text}</span>
            </button>
          ))}
          {filteredItems.length === 0 && (
            <div className="col-span-2 py-8 text-center text-muted-foreground">
              Không tìm thấy kết quả
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
