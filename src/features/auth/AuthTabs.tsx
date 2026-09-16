import "@rainbow-me/rainbowkit/styles.css";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Users, KeyRound, Wallet } from "lucide-react";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { EmailOtpLogin } from "@/modules/auth/components/EmailOtpLogin";
import { SocialLogin } from "@/modules/auth/components/SocialLogin";
import { ClassicEmailLogin } from "@/modules/auth/components/ClassicEmailLogin";
import { WalletLoginPanel } from "./wallet/WalletLoginPanel";
import { WalletLinkPanel } from "./wallet/WalletLinkPanel";

interface AuthTabsProps {
  onOtpSuccess: (userId: string, isNewUser: boolean) => void;
  onSocialSuccess: (userId: string, isNewUser: boolean) => void;
  onClassicSuccess: (userId: string, isNewUser: boolean) => void;
  onWalletLoginSuccess: (userId: string, isNewUser: boolean, needsEmailVerification: boolean) => void;
}

export function AuthTabs({
  onOtpSuccess,
  onSocialSuccess,
  onClassicSuccess,
  onWalletLoginSuccess,
}: AuthTabsProps) {
  const [activeTab, setActiveTab] = useState("email");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-6 bg-muted/50 p-1.5 rounded-full border border-[#166534]/30">
        <TabsTrigger value="email" className="flex items-center gap-1.5 rounded-full text-sm sm:text-base font-semibold">
          <Mail size={16} />
          <span className="hidden sm:inline">OTP</span>
        </TabsTrigger>
        <TabsTrigger value="wallet" className="flex items-center gap-1.5 rounded-full text-sm sm:text-base font-semibold">
          <Wallet size={16} />
          <span className="hidden sm:inline">Wallet</span>
        </TabsTrigger>
        <TabsTrigger value="social" className="flex items-center gap-1.5 rounded-full text-sm sm:text-base font-semibold">
          <Users size={16} />
          <span className="hidden sm:inline">Social</span>
        </TabsTrigger>
        <TabsTrigger value="classic" className="flex items-center gap-1.5 rounded-full text-sm sm:text-base font-semibold">
          <KeyRound size={16} />
          <span className="hidden sm:inline">Password</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="email" className="mt-0">
        <EmailOtpLogin onSuccess={onOtpSuccess} />
      </TabsContent>

      <TabsContent value="wallet" className="mt-0">
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#10b981",
            accentColorForeground: "white",
            borderRadius: "large",
          })}
        >
          <div className="space-y-6">
            <WalletLoginPanel onSuccess={onWalletLoginSuccess} />
            <div className="border-t border-border pt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Link Wallet To Current Account</p>
              <WalletLinkPanel />
            </div>
          </div>
        </RainbowKitProvider>
      </TabsContent>

      <TabsContent value="social" className="mt-0">
        <SocialLogin onSuccess={onSocialSuccess} />
      </TabsContent>

      <TabsContent value="classic" className="mt-0">
        <ClassicEmailLogin onSuccess={onClassicSuccess} />
      </TabsContent>
    </Tabs>
  );
}
