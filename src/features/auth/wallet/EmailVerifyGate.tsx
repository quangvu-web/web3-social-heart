import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface EmailVerifyGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
}

export function EmailVerifyGate({ open, onOpenChange, onVerified }: EmailVerifyGateProps) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStart = async () => {
    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-link-start", {
        body: { email },
      });

      if (error) {
        throw new Error((data as any)?.error || error.message || "Failed to send OTP");
      }

      toast.success("Verification OTP sent to your email");
      setStep("otp");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send OTP");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      toast.error("Please enter the 6-digit OTP");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-link-verify", {
        body: { email, otp },
      });

      if (error) {
        throw new Error((data as any)?.error || error.message || "Failed to verify OTP");
      }

      toast.success("Email verified successfully");
      onVerified();
      onOpenChange(false);
      setStep("email");
      setOtp("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to verify OTP");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify Email to Unlock Full Features</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Wallet-first account detected. Please verify your email to unlock posting, commenting, sharing, and rewards.
          </p>

          <div className="space-y-2">
            <Label htmlFor="verify-email">Email</Label>
            <Input
              id="verify-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting || step === "otp"}
              placeholder="you@example.com"
            />
          </div>

          {step === "otp" && (
            <div className="space-y-2">
              <Label htmlFor="verify-otp">OTP</Label>
              <Input
                id="verify-otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={isSubmitting}
                placeholder="6-digit OTP"
              />
            </div>
          )}

          <div className="flex gap-2">
            {step === "email" ? (
              <Button onClick={handleStart} disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="mr-2 animate-spin" size={16} /> : null}
                Send OTP
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep("email")} disabled={isSubmitting}>
                  Change Email
                </Button>
                <Button onClick={handleVerify} disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? <Loader2 className="mr-2 animate-spin" size={16} /> : null}
                  Verify OTP
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
