import { useCallback, useState } from 'react';
import { ShieldCheck, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TelegramOtpChallengeProps {
  challengeId: string;
  userId: string;
  isNewUser: boolean;
  onVerified: (userId: string, isNewUser: boolean) => void;
  onCancel: () => void;
}

export const TelegramOtpChallenge = ({
  challengeId,
  userId,
  isNewUser,
  onVerified,
  onCancel,
}: TelegramOtpChallengeProps) => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = useCallback(async () => {
    if (otp.length !== 6) {
      toast.error('Enter the 6-digit Telegram code');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-2fa-verify', {
        body: { challenge_id: challengeId, code: otp },
      });

      if (error) throw error;

      if (!data?.success || !data?.access_token || !data?.refresh_token) {
        throw new Error(data?.error || 'Telegram verification failed');
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (sessionError) throw sessionError;

      toast.success('Telegram OTP verified');
      onVerified(data.user_id || userId, isNewUser);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Telegram verification failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [challengeId, isNewUser, onVerified, otp, userId]);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-2">
          <Send className="text-emerald-600" size={28} />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Telegram 2FA</h3>
        <p className="text-sm text-slate-500">
          Enter the 6-digit code sent to your Telegram.
        </p>
      </div>

      <div className="space-y-4">
        <Label className="text-slate-700 font-semibold text-sm uppercase tracking-wide block text-center">
          Telegram code
        </Label>
        <div className="flex justify-center">
          <InputOTP value={otp} onChange={setOtp} maxLength={6}>
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className="w-12 h-14 text-xl font-bold border-2 border-slate-300 rounded-full bg-white focus:border-emerald-500"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
      </div>

      <Button
        onClick={handleVerify}
        disabled={loading || otp.length !== 6}
        className="w-full h-14 text-lg font-bold rounded-full relative overflow-hidden text-white"
        style={{
          background: 'linear-gradient(135deg, #166534 0%, #15803d 50%, #166534 100%)',
          boxShadow: '0 4px 20px rgba(22, 101, 52, 0.4)',
        }}
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Verifying
            </>
          ) : (
            <>
              <ShieldCheck size={20} />
              Verify Telegram
            </>
          )}
        </span>
      </Button>

      <button
        onClick={onCancel}
        className="w-full text-sm text-slate-500 hover:text-slate-700"
      >
        Back
      </button>
    </div>
  );
};
