import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { InlineSearch } from './InlineSearch';
import { NotificationDropdown } from './NotificationDropdown';
import { useLanguage } from '@/i18n/LanguageContext';
import { useIsMobileOrTablet } from '@/hooks/use-mobile';
import { TetModeToggle } from '@/components/tet';
import { useFollowingLiveStatus } from '@/modules/live/hooks/useFollowingLiveStatus';
import { EmailVerifyGate } from '@/features/auth/wallet/EmailVerifyGate';
import { useAppVersion } from '@/hooks/useAppVersion';
import { toast } from 'sonner';
import {
  Home,
  Users,
  MessageCircle,
  Menu,
  Wallet,
  LogOut,
  Globe,
  Settings,
  Radio,
  AlertTriangle,
  Gamepad2,
  RefreshCw,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FacebookLeftSidebar } from '@/components/feed/FacebookLeftSidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const FacebookNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const isMobileOrTablet = useIsMobileOrTablet();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [emailGateOpen, setEmailGateOpen] = useState(false);
  
  // Use AuthContext instead of manual auth management
  const { isAuthenticated, user, profile, signOut } = useAuth();
  const { count: liveCount, hasLive } = useFollowingLiveStatus();
  const appVersion = useAppVersion();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const mustVerifyEmail = isAuthenticated && (profile?.trust_level ?? 0) < 1;

  const handleCheckUpdate = async () => {
    if (checkingUpdate) return;
    if (appVersion.updateAvailable) {
      appVersion.updateNow();
      return;
    }
    setCheckingUpdate(true);
    const toastId = toast.loading('Đang kiểm tra phiên bản...');
    try {
      const hasUpdate = await appVersion.checkNow();
      toast.dismiss(toastId);
      if (hasUpdate) {
        toast.success('Đã có phiên bản mới, đang cập nhật...');
        setTimeout(() => appVersion.updateNow(), 400);
      } else {
        toast.success('Bạn đang dùng phiên bản mới nhất');
      }
    } catch {
      toast.dismiss(toastId);
      toast.error('Không kiểm tra được phiên bản');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  // Language options with country flag images
  const languageOptions = [
    { code: 'vi' as const, name: 'Tiếng Việt', flagUrl: 'https://flagcdn.com/w40/vn.png' },
    { code: 'en' as const, name: 'English', flagUrl: 'https://flagcdn.com/w40/us.png' },
    { code: 'zh' as const, name: '中文', flagUrl: 'https://flagcdn.com/w40/cn.png' },
    { code: 'ja' as const, name: '日本語', flagUrl: 'https://flagcdn.com/w40/jp.png' },
    { code: 'ko' as const, name: '한국어', flagUrl: 'https://flagcdn.com/w40/kr.png' },
    { code: 'th' as const, name: 'ไทย', flagUrl: 'https://flagcdn.com/w40/th.png' },
    { code: 'id' as const, name: 'Indonesia', flagUrl: 'https://flagcdn.com/w40/id.png' },
    { code: 'fr' as const, name: 'Français', flagUrl: 'https://flagcdn.com/w40/fr.png' },
    { code: 'es' as const, name: 'Español', flagUrl: 'https://flagcdn.com/w40/es.png' },
    { code: 'de' as const, name: 'Deutsch', flagUrl: 'https://flagcdn.com/w40/de.png' },
    { code: 'pt' as const, name: 'Português', flagUrl: 'https://flagcdn.com/w40/br.png' },
    { code: 'ru' as const, name: 'Русский', flagUrl: 'https://flagcdn.com/w40/ru.png' },
    { code: 'ar' as const, name: 'العربية', flagUrl: 'https://flagcdn.com/w40/sa.png' },
  ];

  // Navigation items for center nav (Desktop only)
  const iconNavItems = [
    { icon: Home, path: '/', label: t('home') },
    { icon: Users, path: '/friends', label: t('friends') },
    { icon: MessageCircle, path: '/chat', label: 'Chat' },
    { icon: Gamepad2, path: '/fun-play', label: 'FUN Play' },
    { icon: Wallet, path: '/wallet', label: 'Wallet' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 fb-header h-12 md:h-14 safe-area-top">
      <div className="h-full max-w-screen-2xl mx-auto px-2 sm:px-4 flex items-center justify-between">
        {/* Left Section - Menu Button & Logo & Search */}
        <div className="flex items-center gap-2 flex-shrink-0 md:w-[280px]">
          {/* Menu Button - Left of Logo (Mobile/Tablet only) */}
          {isMobileOrTablet && (
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <button 
                  className="fun-icon-btn flex-shrink-0"
                  aria-label="Menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] p-4 overflow-y-auto">
                <FacebookLeftSidebar onItemClick={() => setIsSidebarOpen(false)} />
              </SheetContent>
            </Sheet>
          )}

          {/* Logo */}
          <img
            src="/fun-profile-logo-40.webp"
            alt="FUN Profile"
            width={36}
            height={36}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full cursor-pointer flex-shrink-0"
            onClick={() => navigate('/')}
            loading="eager"
          />
          <div className="hidden sm:block">
            <InlineSearch />
          </div>
        </div>

        {/* Center Section - Navigation (Desktop only, hidden on tablet) */}
        <nav className="hidden lg:flex items-center justify-center flex-1 max-w-[600px] h-full gap-1">
          <TooltipProvider delayDuration={200}>
            {iconNavItems.map((item) => (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(item.path)}
                    aria-label={item.label}
                    className={`flex-1 h-full max-w-[100px] flex items-center justify-center relative transition-all duration-300 rounded-full border-[0.5px] group ${
                      isActive(item.path)
                        ? 'text-primary-foreground bg-primary border-gold'
                        : 'text-foreground hover:text-primary hover:bg-primary/10 border-transparent hover:border-gold/50'
                    }`}
                  >
                    <item.icon className={`w-6 h-6 transition-all duration-300 ${
                      isActive(item.path) 
                        ? '' 
                        : 'group-hover:drop-shadow-[0_0_6px_hsl(142_76%_36%/0.5)]'
                    }`} />
                    {isActive(item.path) && (
                      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-gold to-primary rounded-t-full" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-card text-card-foreground border border-border">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}

            {/* Live button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/live')}
                  aria-label="Live"
                  className={`flex-1 h-full max-w-[100px] flex items-center justify-center relative transition-all duration-300 rounded-full border-[0.5px] group ${
                    isActive('/live')
                      ? 'text-primary-foreground bg-primary border-gold'
                      : 'text-foreground hover:text-destructive hover:bg-destructive/10 border-transparent hover:border-destructive/50'
                  }`}
                >
                  <div className="relative">
                    <Radio className={`w-6 h-6 transition-all duration-300 ${
                      isActive('/live') ? '' : 'group-hover:drop-shadow-[0_0_6px_hsl(0_84%_60%/0.6)]'
                    }`} />
                    {hasLive && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-destructive text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 animate-pulse">
                        {liveCount > 9 ? '9+' : liveCount}
                      </span>
                    )}
                  </div>
                  {isActive('/live') && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-gold to-primary rounded-t-full" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-card text-card-foreground border border-border">
                <p>Live{hasLive ? ` (${liveCount} đang live)` : ''}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </nav>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 md:w-[280px] justify-end">
          {/* Search button for mobile */}
          <div className="sm:hidden">
            <InlineSearch />
          </div>

          {/* Mobile/Tablet: Wallet icon */}
          {isMobileOrTablet && (
            <button 
              className="fun-icon-btn-gold group" 
              aria-label="Wallet"
              onClick={() => navigate('/wallet')}
            >
              <Wallet className="w-5 h-5 text-gold drop-shadow-[0_0_6px_hsl(48_96%_53%/0.5)] group-hover:drop-shadow-[0_0_12px_hsl(48_96%_53%/0.8)] transition-all duration-300" />
            </button>
          )}

          {mustVerifyEmail && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 border-amber-500/40 text-amber-700 hover:text-amber-800"
              onClick={() => setEmailGateOpen(true)}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Verify Email</span>
            </Button>
          )}

          {/* Notification for mobile/tablet */}
          {isMobileOrTablet && <NotificationDropdown />}

          {/* Desktop only: Notification Bell + Avatar with Dropdown */}
          {!isMobileOrTablet && isAuthenticated && (
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex-shrink-0" aria-label="Profile Menu">
                    <Avatar className="w-9 h-9 border-2 border-gold/30 hover:border-gold transition-colors cursor-pointer">
                      <AvatarImage src={profile?.avatar_url || ''} />
                      <AvatarFallback className="bg-primary/20 text-primary text-sm">
                        {profile?.username?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-card border border-border shadow-lg z-50">
                  {/* Go to Profile - with user avatar and name */}
                  <DropdownMenuItem 
                    onClick={() => navigate(`/profile/${user?.id}`)}
                    className="cursor-pointer gap-3 p-3"
                  >
                    <Avatar className="w-10 h-10 border-2 border-gold/30">
                      <AvatarImage src={profile?.avatar_url || ''} />
                      <AvatarFallback className="bg-primary/20 text-primary text-sm">
                        {(profile?.username || user?.email)?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-foreground">
                      {profile?.username || user?.email?.split('@')[0] || 'User'}
                    </span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Language Switcher - Collapsible */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center justify-between w-full px-2 py-2 text-sm hover:bg-accent rounded-md transition-colors">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          <span>{t('language')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <img 
                            src={languageOptions.find(l => l.code === language)?.flagUrl} 
                            alt={language}
                            className="w-5 h-4 object-cover rounded-sm"
                          />
                          <span className="text-xs text-muted-foreground">{language.toUpperCase()}</span>
                        </div>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="left" align="start" className="min-w-[200px]">
                      <div className="grid grid-cols-2 gap-1 p-2">
                        {languageOptions.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => setLanguage(lang.code)}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                              language === lang.code
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'hover:bg-accent text-foreground'
                            }`}
                          >
                            <img 
                              src={lang.flagUrl} 
                              alt={lang.name}
                              className="w-5 h-4 object-cover rounded-sm"
                            />
                            <span>{lang.name}</span>
                          </button>
                        ))}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Tet Mode Toggle */}
                  <div className="px-2 py-2">
                    <TetModeToggle />
                  </div>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Update App */}
                  <DropdownMenuItem
                    onClick={(e) => { e.preventDefault(); handleCheckUpdate(); }}
                    className="cursor-pointer gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
                    <div className="flex flex-1 items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span>Cập nhật app</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          v{(appVersion.current.version || 'dev').slice(0, 7)}
                        </span>
                      </div>
                      {appVersion.updateAvailable && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          Mới
                        </span>
                      )}
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Account Settings */}
                  <DropdownMenuItem 
                    onClick={() => navigate('/settings/account')}
                    className="cursor-pointer gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    <span>{t('accountSettings') || 'Account Settings'}</span>
                  </DropdownMenuItem>
                  
                  {/* Logout */}
                  <DropdownMenuItem 
                    onClick={handleSignOut}
                    className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t('signOut')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Sign In Button - Only show when not logged in */}
          {!isAuthenticated && (
            <Button
              onClick={() => navigate('/auth')}
              className="bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              {t('signIn')}
            </Button>
          )}
        </div>
      </div>

      <EmailVerifyGate
        open={emailGateOpen}
        onOpenChange={setEmailGateOpen}
        onVerified={() => {
          window.location.reload();
        }}
      />
    </header>
  );
};
