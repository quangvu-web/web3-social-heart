import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/i18n/LanguageContext';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import {
  UsersRound,
  Flag,
  Sparkles,
  LogOut,
  Globe,
  Link2,
  BookOpen,
} from 'lucide-react';
// Use direct paths for logos to ensure consistency across all environments
// Cloudflare Image Resizing only works on fun.rich domain

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  full_name: string | null;
}

interface FacebookLeftSidebarProps {
  onItemClick?: () => void;
}

export const FacebookLeftSidebar = ({ onItemClick }: FacebookLeftSidebarProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsLoggedIn(true);
        const { data } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, full_name')
          .eq('id', session.user.id)
          .single();
        setProfile(data);
      }
    };
    fetchProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
      if (!session) {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
    onItemClick?.();
  };

  // Shortcuts for "Lối tắt của bạn" section
  const shortcutItems = [
    { icon: UsersRound, label: t('groups'), path: '/groups', color: 'text-blue-500' },
    { icon: Flag, label: t('pages') || 'Trang', path: '/pages', color: 'text-orange-500' },
    { icon: Link2, label: 'Connected Apps', path: '/profile/connected-apps', color: 'text-purple-500' },
    { icon: BookOpen, label: 'SSO Docs', path: '/docs/ecosystem', color: 'text-green-500' },
  ];

  // FUN Ecosystem shortcuts - use direct paths for consistency across all environments
  const ecosystemShortcuts = useMemo(() => [
    { 
      name: 'Law of Light', 
      avatar: '/fun-profile-logo-40.webp',
      path: '/law-of-light?view=true',
      isExternal: false,
      isSpecial: true
    },
    { 
      name: 'About FUN Profile', 
      avatar: '/fun-profile-logo-40.webp',
      path: '/about',
      isExternal: false,
      isSpecial: false
    },
    { 
      name: 'FUN Play', 
      avatar: '/fun-play-logo-36.webp',
      path: 'https://play.fun.rich',
      isExternal: true,
      isSpecial: false
    },
    { 
      name: 'FUN Farm', 
      avatar: '/fun-farm-logo-36.webp',
      path: 'https://farm.fun.rich',
      isExternal: true,
      isSpecial: false
    },
    { 
      name: 'FUN Planet', 
      avatar: '/fun-planet-logo-36.webp',
      path: 'https://planet.fun.rich',
      isExternal: true,
      isSpecial: false
    },
    { 
      name: 'FUN Wallet', 
      avatar: '/fun-wallet-logo-36.webp',
      path: 'https://wallet.fun.rich',
      isExternal: true,
      isSpecial: false
    },
    { 
      name: 'FUN Charity', 
      avatar: '/fun-charity-logo-36.webp',
      path: 'https://charity.fun.rich',
      isExternal: true,
      isSpecial: false
    },
    { 
      name: 'FUN Academy', 
      avatar: '/fun-academy-logo-36.webp',
      path: 'https://academy.fun.rich',
      isExternal: true,
      isSpecial: false
    },
    { 
      name: 'FUN Treasury', 
      avatar: '/fun-treasury-logo-36.webp',
      path: 'https://treasury.fun.rich',
      isExternal: true,
      isSpecial: false
    },
    { 
      name: 'Green Earth', 
      avatar: '/green-earth-logo-36.webp',
      path: 'https://greenearth-fun.lovable.app',
      isExternal: true,
      isSpecial: false
    },
  ], []);

  return (
    <div className="space-y-3">
      {/* Card 1: FUN ECOSYSTEM */}
      <div className="bg-card rounded-xl border-2 border-yellow-400/50 p-4 hover:border-yellow-400 hover:shadow-[0_0_20px_rgba(250,204,21,0.3)] transition-all duration-300">
        <div className="flex items-center gap-2 mb-3">
          <img 
            src="/fun-ecosystem-logo-36.webp" 
            alt="FUN Ecosystem" 
            className="w-8 h-8 rounded-full object-cover"
          />
          <h3 
            className="font-black text-[22px] tracking-wider uppercase"
            style={{
              fontFamily: "'Orbitron', 'Rajdhani', sans-serif",
              background: 'linear-gradient(135deg, #FFD700 0%, #FFEC8B 15%, #FFD700 30%, #FFC125 50%, #FFD700 70%, #FFEC8B 85%, #FFD700 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 1px 2px rgba(255, 215, 0, 0.5))',
            }}
          >
            {t('funEcosystem')}
          </h3>
        </div>
        <div className="space-y-1">
          {ecosystemShortcuts.map((shortcut) => (
            <button
              key={shortcut.name}
              onClick={() => {
                if (shortcut.isExternal) {
                  window.open(shortcut.path, '_blank', 'noopener,noreferrer');
                } else {
                  navigate(shortcut.path);
                }
                onItemClick?.();
              }}
              className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all duration-300 group ${
                shortcut.isSpecial 
                  ? 'bg-gradient-to-r from-yellow-400/10 to-amber-400/10 hover:bg-white hover:shadow-[0_0_12px_rgba(34,197,94,0.5)] border border-yellow-400/30 hover:border-primary' 
                  : 'hover:bg-white hover:shadow-[0_0_12px_rgba(34,197,94,0.5)]'
              }`}
            >
              {shortcut.isSpecial ? (
                <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                     style={{
                       background: 'radial-gradient(circle, rgba(250,204,21,0.3) 0%, rgba(250,204,21,0.1) 100%)',
                       boxShadow: '0 0 15px rgba(250,204,21,0.4)'
                     }}>
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                </div>
              ) : (
                <img
                  src={shortcut.avatar}
                  alt={shortcut.name}
                  width={36}
                  height={36}
                  loading="lazy"
                  className="w-9 h-9 rounded-full object-cover group-hover:shadow-[0_0_10px_rgba(250,204,21,0.5)] transition-shadow duration-300"
                />
              )}
              <span className={`font-medium text-sm transition-colors duration-300 ${
                shortcut.isSpecial 
                  ? 'text-yellow-400 group-hover:text-yellow-300 font-semibold' 
                  : 'group-hover:text-primary'
              }`}>
                {shortcut.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Card 2: Your Shortcuts - Avatar + Name, Groups, Pages */}
      <div className="bg-card rounded-xl border-2 border-yellow-400/50 p-4 hover:border-yellow-400 hover:shadow-[0_0_20px_rgba(250,204,21,0.3)] transition-all duration-300">
        <h3 className="font-bold text-sm mb-3 text-muted-foreground">
          {t('yourShortcuts')}
        </h3>
        <div className="space-y-1">
          {/* User Profile */}
          {profile && (
            <button
              onClick={() => { navigate(`/profile/${profile.id}`); onItemClick?.(); }}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-[0_0_12px_rgba(34,197,94,0.5)] transition-all duration-300"
            >
              <Avatar className="w-9 h-9 ring-2 ring-yellow-400/50">
                <AvatarImage src={profile.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {profile.username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-semibold text-sm">{profile.username}</span>
            </button>
          )}

          {/* Shortcut Items - Groups, Pages */}
          {shortcutItems.map((item) => (
            <button
              key={item.label}
              onClick={() => { navigate(item.path); onItemClick?.(); }}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-[0_0_12px_rgba(34,197,94,0.5)] transition-all duration-300"
            >
              <div className={`w-9 h-9 rounded-full bg-secondary flex items-center justify-center ${item.color}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Card 3: Menu - Language Switcher & Logout */}
      <div className="bg-card rounded-xl border-2 border-yellow-400/50 p-4 hover:border-yellow-400 hover:shadow-[0_0_20px_rgba(250,204,21,0.3)] transition-all duration-300">
        <h3 className="font-bold text-sm mb-3 text-muted-foreground">
          Menu
        </h3>
        <div className="space-y-1">
          {/* Language Switcher */}
          <div className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-[0_0_12px_rgba(34,197,94,0.5)] transition-all duration-300">
            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-blue-500">
              <Globe className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <LanguageSwitcher variant="full" />
            </div>
          </div>

          {/* Logout Button */}
          {isLoggedIn && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-[0_0_12px_rgba(239,68,68,0.5)] transition-all duration-300 text-destructive"
            >
              <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="font-medium text-sm">{t('signOut')}</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 text-xs text-muted-foreground border-t border-border mt-3">
          <p>{t('privacyPolicy')} · {t('termsOfService')}</p>
          <p className="mt-1">FUN Profile © 2025</p>
        </div>
      </div>
    </div>
  );
};
