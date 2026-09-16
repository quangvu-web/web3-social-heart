import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { config } from "@/config/web3";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { LawOfLightGuard } from "@/modules/auth";
import { CallProvider } from "@/contexts/CallContext";
import { useSessionKeepAlive } from "@/hooks/useSessionKeepAlive";
import { TetThemeProvider } from "@/contexts/TetThemeContext";
import { TetOverlay } from "@/components/tet";
import { ChatPanel, CallOverlay, FunChatProvider, type FunChatConfig } from "@fun/chat-call";
import { funChatCallAdapter } from "@/integrations/funChatCallAdapter";
import { HostCallOverlayRenderer, HostChatPanelRenderer } from "@/integrations/funChatCallRenderers";
import { ReplayUploadIndicator } from "@/modules/live/components/ReplayUploadIndicator";
import { UpdateSnackbar } from "@/components/common/UpdateSnackbar";
import { AngelFAB } from "@/components/angel/AngelFAB";
import { AppErrorBoundary } from "@/components/common/AppErrorBoundary";
import { AppErrorFallback } from "@/components/common/AppErrorFallback";


// Lazy load pages for code splitting
// Auth module pages
const Auth = lazy(() => import("@/modules/auth/pages/Auth"));
const LawOfLight = lazy(() => import("@/modules/auth/pages/LawOfLight"));
const SetPassword = lazy(() => import("@/modules/auth/pages/SetPassword"));
// Lazy load pages for code splitting
// Other pages (will be migrated to modules later)
const Feed = lazy(() => import("@/modules/feed/pages/Feed"));
const Post = lazy(() => import("@/modules/feed/pages/Post"));
const Friends = lazy(() => import("./pages/Friends"));
const Profile = lazy(() => import("./pages/Profile"));
const Wallet = lazy(() => import("./pages/Wallet"));
const FunPlay = lazy(() => import("./pages/FunPlay"));
const About = lazy(() => import("./pages/About"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const AdminMigration = lazy(() => import("./pages/AdminMigration"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminMeditation = lazy(() => import("./pages/AdminMeditation"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Notifications = lazy(() => import("./pages/Notifications"));
const DocsRouter = lazy(() => import("./pages/DocsRouter"));
const ConnectedApps = lazy(() => import("./pages/ConnectedApps"));
const LiveStudio = lazy(() => import("@/modules/live/pages/LiveStudio"));
const LiveStream = lazy(() => import("@/modules/live/pages/LiveStream"));
const LiveHostPage = lazy(() => import("@/modules/live/pages/LiveHostPage"));
const LiveWebcamStudioPage = lazy(() => import("@/modules/live/pages/LiveWebcamStudioPage"));
const RtmpHostPage = lazy(() => import("@/modules/live/pages/RtmpHostPage"));
const LiveAudiencePage = lazy(() => import("@/modules/live/pages/LiveAudiencePage"));
const Install = lazy(() => import("./pages/Install"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const Telegram2FAGuide = lazy(() => import("./pages/Telegram2FAGuide"));
const TelegramBotGuide = lazy(() => import("./pages/TelegramBotGuide"));
const LiveDiscoveryPage = lazy(() => import("./pages/LiveDiscoveryPage"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

// Optimized QueryClient with caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Loading fallback component with smooth animation
const PageLoader = () => {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), 12_000);
    return () => window.clearTimeout(timer);
  }, []);

  if (timedOut) {
    return (
      <AppErrorFallback
        code="bootstrap_timeout"
        message="Ứng dụng có thể vừa được cập nhật hoặc kết nối đang gặp sự cố."
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="w-10 h-10 md:w-12 md:h-12 border-3 md:border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
};

function RouteScrollLock() {
  const { pathname } = useLocation();

  useEffect(() => {
    const isChatRoute = pathname === "/chat" || pathname.startsWith("/chat/");
    if (!isChatRoute) return;

    const html = document.documentElement;
    const body = document.body;

    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
    };

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.overscrollBehavior = prev.bodyOverscrollBehavior;
    };
  }, [pathname]);

  return null;
}

function App() {
  // Keep session alive - prevents auto sign-out when tab is in background
  useSessionKeepAlive();

  const funChatConfig = useMemo<FunChatConfig>(
    () => ({
      appName: "FUN Profile",
      renderers: {
        ChatPanel: () => <HostChatPanelRenderer />,
        CallOverlay: () => <HostCallOverlayRenderer />,
      },
    }),
    []
  );

  return (
    <WagmiProvider config={config}>
      <LanguageProvider>
        <TetThemeProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <TetOverlay />
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AuthProvider>
                  <CallProvider renderIncomingDialog={false}>
                    <FunChatProvider config={funChatConfig} adapter={funChatCallAdapter}>
                      <AppErrorBoundary>
                      <Suspense fallback={<PageLoader />}>
                        <RouteScrollLock />
                        <CallOverlay />
                        <ReplayUploadIndicator />
                        <UpdateSnackbar />
                        <LawOfLightGuard>
                    <Routes>
                      <Route path="/begin" element={<Navigate to="/law-of-light" replace />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                      <Route path="/set-password" element={<SetPassword />} />
                      <Route path="/law-of-light" element={<LawOfLight />} />
                      <Route path="/" element={<Feed />} />
                      <Route path="/friends" element={<Friends />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/profile/:userId" element={<Profile />} />
                      <Route path="/profile/connected-apps" element={<ConnectedApps />} />
                      <Route path="/@:username" element={<Profile />} />
                      <Route path="/wallet" element={<Wallet />} />
                      <Route path="/fun-play" element={<FunPlay />} />
                      <Route path="/post/:postId" element={<Post />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/leaderboard" element={<Leaderboard />} />
                      <Route path="/admin/migration" element={<AdminMigration />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="/admin/meditation" element={<AdminMeditation />} />
                      <Route path="/notifications" element={<Notifications />} />
                      <Route path="/chat" element={<ChatPanel />} />
                      <Route path="/chat/:conversationId" element={<ChatPanel />} />
                      <Route path="/live" element={<LiveDiscoveryPage />} />
                      <Route path="/live/new" element={<LiveWebcamStudioPage />} />
                      <Route path="/live/rtmp/new" element={<RtmpHostPage />} />
                      <Route path="/live/:liveSessionId/rtmp/host" element={<RtmpHostPage />} />
                      <Route path="/live/:liveSessionId/host" element={<LiveHostPage />} />
                      <Route path="/live/:liveSessionId" element={<LiveAudiencePage />} />
                      <Route path="/live/stream" element={<LiveStream />} />
                      <Route path="/live/studio/:liveSessionId" element={<LiveStudio />} />
                      <Route path="/docs/*" element={<DocsRouter />} />
                      <Route path="/install" element={<Install />} />
                      <Route path="/settings/account" element={<AccountSettings />} />
                     <Route path="/settings/telegram-2fa-guide" element={<Telegram2FAGuide />} />
                     <Route path="/telegram-bot-guide" element={<TelegramBotGuide />} />
                      {/* Dynamic username route - must be AFTER static routes */}
                      <Route path="/:username" element={<Profile />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                        </LawOfLightGuard>
                        <AngelFAB />
                      </Suspense>
                      </AppErrorBoundary>

                    </FunChatProvider>
                  </CallProvider>
                </AuthProvider>
              </BrowserRouter>
            </TooltipProvider>
          </QueryClientProvider>
        </TetThemeProvider>
      </LanguageProvider>
    </WagmiProvider>
  );
}

export default App;
