import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Globe, Users, Lock, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

export interface PrivacyOption {
  value: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface PrivacySelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const PrivacySelector = ({ value, onChange, disabled }: PrivacySelectorProps) => {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const PRIVACY_OPTIONS: PrivacyOption[] = [
    { 
      value: 'public', 
      label: language === 'vi' ? 'Công khai' : 'Public', 
      icon: Globe, 
      description: language === 'vi' ? 'Bất kỳ ai ở trên hoặc ngoài FUN Profile' : 'Anyone on or off FUN Profile' 
    },
    { 
      value: 'friends', 
      label: language === 'vi' ? 'Bạn bè' : 'Friends', 
      icon: Users, 
      description: language === 'vi' ? 'Bạn bè của bạn trên FUN Profile' : 'Your friends on FUN Profile' 
    },
    { 
      value: 'private', 
      label: language === 'vi' ? 'Chỉ mình tôi' : 'Only me', 
      icon: Lock, 
      description: language === 'vi' ? 'Chỉ bạn có thể xem bài viết này' : 'Only you can see this post' 
    },
  ];

  const selectedOption = PRIVACY_OPTIONS.find(opt => opt.value === value) || PRIVACY_OPTIONS[0];
  const SelectedIcon = selectedOption.icon;

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <>
      <Button 
        type="button"
        variant="secondary" 
        size="sm" 
        className="h-6 text-xs mt-1 gap-1"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsOpen(true);
        }}
        disabled={disabled}
      >
        <SelectedIcon className="w-3 h-3" />
        {selectedOption.label}
        <ChevronDown className="w-3 h-3" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen} modal={true}>
        <DialogContent className="sm:max-w-[400px] p-0 z-[200]">
          <DialogHeader className="p-4 border-b border-border">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute left-4 w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <DialogTitle className="text-center flex-1 text-lg font-bold">
                {language === 'vi' ? 'Đối tượng của bài viết' : 'Post audience'}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="p-4">
            <p className="text-sm text-muted-foreground mb-4">
              {language === 'vi' 
                ? 'Ai có thể xem bài viết của bạn?' 
                : 'Who can see your post?'}
            </p>

            <div className="space-y-1">
              {PRIVACY_OPTIONS.map((option) => {
                const OptionIcon = option.icon;
                const isSelected = value === option.value;
                
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                      isSelected ? 'bg-primary/5' : 'hover:bg-secondary'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      isSelected ? 'bg-primary/10' : 'bg-secondary'
                    }`}>
                      <OptionIcon className={`w-6 h-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{option.label}</p>
                      <p className="text-sm text-muted-foreground truncate">{option.description}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected 
                        ? 'border-primary bg-primary' 
                        : 'border-muted-foreground/30'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
