import React, { memo, useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Globe, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Language } from '@/i18n/translations';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'pill' | 'icon' | 'full' | 'dropdown';
}

// 13 language options with flags
const languageOptions = [
  { code: 'vi' as Language, name: 'VI', fullName: 'Tiếng Việt', flagUrl: 'https://flagcdn.com/w40/vn.png' },
  { code: 'en' as Language, name: 'EN', fullName: 'English', flagUrl: 'https://flagcdn.com/w40/us.png' },
  { code: 'zh' as Language, name: 'ZH', fullName: '中文', flagUrl: 'https://flagcdn.com/w40/cn.png' },
  { code: 'ja' as Language, name: 'JA', fullName: '日本語', flagUrl: 'https://flagcdn.com/w40/jp.png' },
  { code: 'ko' as Language, name: 'KO', fullName: '한국어', flagUrl: 'https://flagcdn.com/w40/kr.png' },
  { code: 'th' as Language, name: 'TH', fullName: 'ไทย', flagUrl: 'https://flagcdn.com/w40/th.png' },
  { code: 'id' as Language, name: 'ID', fullName: 'Indonesia', flagUrl: 'https://flagcdn.com/w40/id.png' },
  { code: 'fr' as Language, name: 'FR', fullName: 'Français', flagUrl: 'https://flagcdn.com/w40/fr.png' },
  { code: 'es' as Language, name: 'ES', fullName: 'Español', flagUrl: 'https://flagcdn.com/w40/es.png' },
  { code: 'de' as Language, name: 'DE', fullName: 'Deutsch', flagUrl: 'https://flagcdn.com/w40/de.png' },
  { code: 'pt' as Language, name: 'PT', fullName: 'Português', flagUrl: 'https://flagcdn.com/w40/br.png' },
  { code: 'ru' as Language, name: 'RU', fullName: 'Русский', flagUrl: 'https://flagcdn.com/w40/ru.png' },
  { code: 'ar' as Language, name: 'AR', fullName: 'العربية', flagUrl: 'https://flagcdn.com/w40/sa.png' },
];

const LanguageSwitcher = memo(({
  className,
  variant = 'pill'
}: LanguageSwitcherProps) => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  
  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'vi' : 'en');
  };

  const currentLang = languageOptions.find(l => l.code === language) || languageOptions[0];

  // New dropdown variant with 13 languages
  if (variant === 'dropdown') {
    return (
      <div className={cn("relative", className)}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:border-primary/50 transition-all shadow-sm"
        >
          <img 
            src={currentLang.flagUrl} 
            alt={currentLang.fullName}
            className="w-6 h-4 object-cover rounded-sm shadow-sm"
          />
          <span className="font-medium text-sm text-gray-700">{currentLang.name}</span>
          <ChevronDown className={cn("w-4 h-4 text-gray-500 transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown menu */}
            <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-2 min-w-[200px] max-h-[400px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-1 px-2">
                {languageOptions.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors",
                      language === lang.code
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-gray-100 text-gray-700'
                    )}
                  >
                    <img 
                      src={lang.flagUrl} 
                      alt={lang.fullName}
                      className="w-5 h-4 object-cover rounded-sm shadow-sm"
                    />
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (variant === 'icon') {
    return (
      <button 
        onClick={toggleLanguage} 
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full",
          "bg-card hover:bg-primary/10 border border-border",
          "transition-all duration-300",
          "hover:shadow-[0_0_15px_rgba(34,197,94,0.4)]",
          className
        )} 
        aria-label={`Switch to ${language === 'en' ? 'Vietnamese' : 'English'}`} 
        title={language === 'en' ? 'Chuyển sang Tiếng Việt' : 'Switch to English'}
      >
        <Globe className="w-5 h-5 text-primary" />
        <span className="absolute -bottom-1 -right-1 text-xs font-bold text-primary">
          {language.toUpperCase()}
        </span>
      </button>
    );
  }

  if (variant === 'full') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="relative flex items-center bg-muted rounded-lg p-1">
          {/* Sliding background indicator */}
          <div 
            className={cn(
              "absolute h-[calc(100%-8px)] w-[calc(50%-4px)] bg-primary rounded-md",
              "transition-all duration-300 ease-out",
              "shadow-[0_0_12px_rgba(34,197,94,0.6)]",
              language === 'en' ? "left-1" : "left-[calc(50%+2px)]"
            )} 
          />
          <button 
            onClick={() => setLanguage('en')} 
            className={cn(
              "relative z-10 px-3 py-1 rounded-md text-sm font-medium",
              "transition-all duration-300 ease-out",
              language === 'en' ? "text-primary-foreground scale-105" : "text-muted-foreground hover:text-foreground"
            )}
          >
            EN
          </button>
          <button 
            onClick={() => setLanguage('vi')} 
            className={cn(
              "relative z-10 px-3 py-1 rounded-md text-sm font-medium",
              "transition-all duration-300 ease-out",
              language === 'vi' ? "text-primary-foreground scale-105" : "text-muted-foreground hover:text-foreground"
            )}
          >
            VI
          </button>
        </div>
      </div>
    );
  }

  // Default: pill variant
  return (
    <button 
      onClick={toggleLanguage} 
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full",
        "bg-card hover:bg-primary/10 border-2 border-yellow-400/50",
        "transition-all duration-300",
        "hover:border-yellow-400 hover:shadow-[0_0_15px_rgba(250,204,21,0.4)]",
        "text-sm font-semibold",
        className
      )} 
      aria-label={`Switch to ${language === 'en' ? 'Vietnamese' : 'English'}`} 
      title={language === 'en' ? 'Chuyển sang Tiếng Việt' : 'Switch to English'}
    >
      <Globe className="w-4 h-4 text-primary" />
      <span className={cn("transition-all duration-300", language === 'en' ? "text-primary" : "text-muted-foreground")}>
        EN
      </span>
      <span className="text-muted-foreground">/</span>
      <span className={cn("transition-all duration-300", language === 'vi' ? "text-primary" : "text-muted-foreground")}>
        VI
      </span>
    </button>
  );
});

LanguageSwitcher.displayName = 'LanguageSwitcher';
export default LanguageSwitcher;
