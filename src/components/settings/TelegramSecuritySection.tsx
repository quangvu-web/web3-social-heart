import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Loader2, Send, ShieldCheck, ShieldOff, Unlink, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const TelegramSecuritySection = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deepLink, setDeepLink] = useState<string | null>(null);

  const isLinked = Boolean(profile?.telegram_chat_id);
  const isEnabled = Boolean(profile?.telegram_2fa_enabled && profile?.telegram_chat_id);

  const handleCreateLink = async () => {
    setLoading(true);
    setDeepLink(null);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-link-start', {
        body: {},
      });

      if (error) throw error;
      if (!data?.success || !data?.deep_link) {
        throw new Error(data?.error || 'Failed to create Telegram link');
      }

      setDeepLink(data.deep_link);
      toast.success('Đã tạo link Telegram — bấm "Mở Telegram" bên dưới để liên kết');

      // Poll for webhook completion: refresh profile every 3s up to 60s
      let attempts = 0;
      const maxAttempts = 20;
      const poll = setInterval(async () => {
        attempts++;
        await refreshProfile();
        if (attempts >= maxAttempts) clearInterval(poll);
      }, 3000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create Telegram link';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };


  const handleToggle = async (checked: boolean) => {
    if (!user?.id || !isLinked) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-settings', {
        body: { action: 'set_enabled', enabled: checked },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to update Telegram 2FA');
      await refreshProfile();
      toast.success(checked ? 'Telegram 2FA enabled' : 'Telegram 2FA disabled');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update Telegram 2FA';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-settings', {
        body: { action: 'unlink' },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to disconnect Telegram');
      setDeepLink(null);
      await refreshProfile();
      toast.success('Telegram disconnected');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to disconnect Telegram';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Telegram 2FA
          </span>
          <Badge variant={isEnabled ? 'default' : 'secondary'} className={isEnabled ? 'bg-green-500/20 text-green-600 hover:bg-green-500/30' : ''}>
            {isEnabled ? 'Enabled' : isLinked ? 'Linked' : 'Not linked'}
          </Badge>
        </CardTitle>
        <CardDescription className="flex items-center justify-between gap-2">
          <span>Receive a 6-digit Telegram OTP after email, wallet, or password login.</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-primary hover:text-primary"
            onClick={() => navigate('/settings/telegram-2fa-guide')}
          >
            <HelpCircle className="w-3.5 h-3.5 mr-1" />
            Hướng dẫn
          </Button>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLinked ? (
          <>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">
                  {profile?.telegram_username ? `@${profile.telegram_username}` : 'Telegram connected'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {profile?.telegram_linked_at
                    ? `Linked ${new Date(profile.telegram_linked_at).toLocaleDateString()}`
                    : 'Ready for login verification'}
                </p>
              </div>
              <Switch checked={isEnabled} onCheckedChange={handleToggle} disabled={loading} />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleUnlink}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlink className="w-4 h-4 mr-2" />}
              Disconnect Telegram
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <ShieldOff className="w-5 h-5 mt-0.5 text-muted-foreground" />
              <div className="space-y-1">
                <p className="font-medium">Telegram chưa được liên kết</p>
                <p className="text-sm text-muted-foreground">
                  Bấm "Connect Telegram" để tạo link liên kết, sau đó mở Telegram bằng nút bên dưới.
                </p>
              </div>
            </div>

            {!deepLink && (
              <Button
                className="w-full"
                onClick={handleCreateLink}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Connect Telegram
              </Button>
            )}

            {deepLink && (
              <div className="space-y-3 p-3 rounded-lg border border-amber-500/40 bg-amber-500/5">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  ⚠️ Quan trọng: Bấm nút bên dưới để mở Telegram. <b>Tuyệt đối không gõ /start thủ công</b> — bot sẽ không nhận được mã liên kết.
                </p>
                <Button
                  asChild
                  className="w-full"
                  size="lg"
                >
                  <a href={deepLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Mở Telegram để liên kết
                  </a>
                </Button>
                <p className="text-xs text-muted-foreground">
                  Link tự động hết hạn sau 15 phút. Nếu lỡ hết hạn, bấm "Connect Telegram" lại.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={handleCreateLink}
                  disabled={loading}
                >
                  {loading && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                  Tạo link mới
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
