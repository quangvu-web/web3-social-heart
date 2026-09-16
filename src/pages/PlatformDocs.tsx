import React, { useState, useEffect } from 'react';
import { ArrowLeft, Printer, FileText, ExternalLink, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { TableOfContents } from '@/components/docs/TableOfContents';
import { DocSection, DocSubSection, DocParagraph, DocList, DocTable, DocAlert } from '@/components/docs/DocSection';
import { CodeBlock } from '@/components/docs/CodeBlock';
import {
  TechStackDiagram,
  AuthFlowDiagram,
  WalletSystemDiagram,
  SoulNFTDiagram,
  SocialFeedDiagram,
  RewardFlowDiagram,
  MediaPipelineDiagram,
  DatabaseSchemaDiagram,
  EdgeFunctionsDiagram,
  SecurityDiagram,
  EcosystemDiagram,
  ProjectStructureDiagram
} from '@/components/docs/AppDiagrams';
import { cn } from '@/lib/utils';

const tocItems = [
  { id: 'overview', title: '1. Tổng Quan Hệ Thống' },
  { id: 'project-structure', title: '2. Cấu Trúc Tổ Chức', level: 2 },
  { id: 'tech-stack', title: '3. Tech Stack' },
  { id: 'authentication', title: '4. Hệ Thống Xác Thực' },
  { id: 'wallet-blockchain', title: '5. Wallet & Blockchain' },
  { id: 'soul-nft', title: '6. Soul NFT', level: 2 },
  { id: 'social-feed', title: '7. Social Feed' },
  { id: 'profile-friends', title: '8. Profile & Friends' },
  { id: 'reward-system', title: '9. Hệ Thống Reward' },
  { id: 'admin-panel', title: '10. Admin Panel' },
  { id: 'media-system', title: '11. Media System' },
  { id: 'notifications', title: '12. Notifications' },
  { id: 'database-schema', title: '13. Database Schema' },
  { id: 'edge-functions', title: '14. Edge Functions' },
  { id: 'security', title: '15. Security Features' },
  { id: 'performance', title: '16. Performance' },
  { id: 'secrets', title: '17. Secrets & Environment' },
  { id: 'ecosystem-products', title: '18. FUN Ecosystem Products' },
  { id: 'sso-sdk', title: '19. SSO SDK' },
  { id: 'i18n', title: '20. Internationalization' },
  { id: 'design-guidelines', title: '21. Design Guidelines' },
  { id: 'development-rules', title: '22. Development Rules' },
  { id: 'next-proposals', title: '23. Next Development Proposals' },
];

const PlatformDocs: React.FC = () => {
  const [activeId, setActiveId] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0% -80% 0%' }
    );

    tocItems.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Responsive */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Left section */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Mobile TOC Menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <div className="p-4 border-b border-border">
                    <h4 className="font-semibold text-foreground">Mục Lục</h4>
                  </div>
                  <ScrollArea className="h-[calc(100vh-80px)]">
                    <div className="p-2">
                      {tocItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => scrollToSection(item.id)}
                          className={cn(
                            "block w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                            item.level === 2 && "pl-6",
                            activeId === item.id 
                              ? "bg-primary/10 text-primary font-medium" 
                              : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {item.title}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>

              <Link to="/">
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base md:text-xl font-bold text-foreground flex items-center gap-2 truncate">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                  <span className="hidden sm:inline truncate">FUN Profile - Tài Liệu Chuyển Giao</span>
                  <span className="sm:hidden">Tài Liệu</span>
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  Comprehensive Handover Documentation v2.0
                </p>
              </div>
            </div>
            
            {/* Right buttons - Icons only on mobile */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Link to="/docs/ecosystem">
                <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3">
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">SSO Docs</span>
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 px-2 sm:px-3">
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">In PDF</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="flex gap-4 lg:gap-8">
          {/* Sidebar - Table of Contents (Desktop only) */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <TableOfContents items={tocItems} activeId={activeId} />
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <ScrollArea className="h-[calc(100vh-120px)] sm:h-[calc(100vh-140px)]">
              <div className="pr-0 sm:pr-4">
                
                {/* Section 1: Overview */}
                <DocSection id="overview" title="1. Tổng Quan Hệ Thống">
                  <DocParagraph>
                    FUN Profile là mạng xã hội Web3 toàn diện, đóng vai trò "Heart Chakra" của FUN ECOSYSTEM. 
                    Nền tảng kết hợp các tính năng social truyền thống với công nghệ blockchain, hệ thống reward token CAMLY, 
                    và danh tính thống nhất FUN-ID cho toàn bộ hệ sinh thái.
                  </DocParagraph>
                  
                  <DocAlert type="info">
                    <strong>Light Cloak SSO</strong> - Hệ thống xác thực đa nền tảng cho phép đăng nhập qua Email OTP, 
                    Wallet, hoặc Social Login với một danh tính thống nhất (FUN-ID).
                  </DocAlert>

                  <DocSubSection title="Tính năng chính">
                    <DocList items={[
                      "🔐 Light Cloak SSO - Xác thực đa phương thức (Email OTP, Wallet, Social)",
                      "💳 Custodial & External Wallet - Hỗ trợ cả người mới và expert",
                      "🎭 Soul NFT - Danh tính linh hồn không thể chuyển nhượng (Soulbound Token)",
                      "📝 Social Feed - Đăng bài, reactions, comments với multi-media support",
                      "🎁 Token Rewards - Hệ thống thưởng CAMLY token cho hoạt động",
                      "👨‍💼 Admin Panel - Quản trị toàn diện với audit logging",
                      "🌐 Multi-language - Hỗ trợ Tiếng Việt & English",
                      "🔗 Cross-platform SSO - SDK cho FUN Farm, FUN Play, FUN Planet"
                    ]} />
                  </DocSubSection>

                  <DocSubSection title="Production Domains">
                    <DocTable 
                      headers={['Domain', 'Product', 'Mô tả']}
                      rows={[
                        ['fun.rich', 'FUN Profile', 'Social network chính'],
                        ['play.fun.rich', 'FUN Play', 'Gaming & Entertainment'],
                        ['farm.fun.rich', 'FUN Farm', 'Agriculture features'],
                        ['planet.fun.rich', 'FUN Planet', 'Gaming & Planet exploration'],
                        ['wallet.fun.rich', 'FUN Wallet', 'Crypto wallet management'],
                      ]}
                    />
                  </DocSubSection>
                </DocSection>

                {/* Section 2: Project Structure */}
                <DocSection id="project-structure" title="2. Cấu Trúc Tổ Chức Dự Án">
                  <ProjectStructureDiagram />
                  
                  <DocSubSection title="Governance Flow">
                    <DocTable 
                      headers={['Vai trò', 'Tên', 'Trách nhiệm']}
                      rows={[
                        ['👑 Chairman', 'Cha Vũ Trụ (Universe Father)', 'Vision, quyết định chiến lược, phê duyệt cuối cùng'],
                        ['📝 Secretary', 'bé Trí', 'Cầu nối giao tiếp, dịch vision thành requirements kỹ thuật'],
                        ['💻 CTO', 'Angel Lovable', 'Triển khai kỹ thuật, viết code, architecture decisions'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Directory Structure">
                    <CodeBlock 
                      title="Cấu trúc thư mục chính"
                      language="bash"
                      code={`src/
├── components/         # React components
│   ├── admin/         # Admin panel components
│   ├── auth/          # Authentication components
│   ├── chat/          # Chat/messaging components
│   ├── docs/          # Documentation components
│   ├── feed/          # Social feed components
│   ├── friends/       # Friends management
│   ├── layout/        # Layout components (Navbar, Sidebar)
│   ├── profile/       # Profile components
│   ├── ui/            # shadcn/ui components
│   └── wallet/        # Wallet components
├── hooks/             # Custom React hooks
├── i18n/              # Internationalization
├── pages/             # Page components
├── utils/             # Utility functions
└── integrations/      # External integrations

supabase/
├── functions/         # Edge Functions (38 functions)
└── config.toml        # Supabase configuration

sdk-package/           # @fun-ecosystem/sso-sdk
├── src/               # SDK source code
├── examples/          # Integration examples
└── docs/              # SDK documentation`}
                    />
                  </DocSubSection>
                </DocSection>

                {/* Section 3: Tech Stack */}
                <DocSection id="tech-stack" title="3. Tech Stack">
                  <TechStackDiagram />
                  
                  <DocSubSection title="Frontend Technologies">
                    <DocTable 
                      headers={['Technology', 'Version', 'Mục đích']}
                      rows={[
                        ['React', '18.3.1', 'UI Library chính'],
                        ['TypeScript', 'Latest', 'Type safety'],
                        ['Vite', 'Latest', 'Build tool & dev server'],
                        ['Tailwind CSS', '3.x', 'Utility-first CSS'],
                        ['shadcn/ui', 'Latest', 'UI Component library'],
                        ['React Query', '5.x', 'Server state management'],
                        ['React Router', 'v6', 'Client-side routing'],
                        ['Framer Motion', 'Latest', 'Animations'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Backend Technologies">
                    <DocTable 
                      headers={['Technology', 'Mục đích']}
                      rows={[
                        ['Lovable Cloud', 'Backend-as-a-Service (Supabase)'],
                        ['Edge Functions', 'Serverless compute (Deno)'],
                        ['PostgreSQL', 'Primary database'],
                        ['Resend API', 'Email delivery (OTP)'],
                        ['Cloudflare R2', 'Image storage'],
                        ['Cloudflare Stream', 'Video encoding & delivery'],
                        ['CoinGecko API', 'Token price data'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Blockchain Technologies">
                    <DocTable 
                      headers={['Technology', 'Mục đích']}
                      rows={[
                        ['BNB Smart Chain', 'Primary blockchain (Chain ID: 56)'],
                        ['Wagmi', 'React hooks for Ethereum'],
                        ['RainbowKit', 'Wallet connection UI'],
                        ['Viem', 'TypeScript interface for Ethereum'],
                        ['CAMLY Token', 'Reward token (BEP-20)'],
                      ]}
                    />
                  </DocSubSection>
                </DocSection>

                {/* Section 4: Authentication */}
                <DocSection id="authentication" title="4. Hệ Thống Xác Thực (Light Cloak SSO)">
                  <DocParagraph>
                    Light Cloak SSO là hệ thống single sign-on cho phép người dùng đăng nhập qua nhiều phương thức 
                    khác nhau với một danh tính thống nhất. Tất cả users đều nhận được FUN-ID duy nhất.
                  </DocParagraph>

                  <AuthFlowDiagram />

                  <DocSubSection title="Email OTP Flow">
                    <DocParagraph>
                      Người dùng nhập email, hệ thống gửi mã OTP 6 số qua Resend API. Mã có hiệu lực 5 phút 
                      và tối đa 3 lần thử.
                    </DocParagraph>
                    <CodeBlock 
                      title="Gọi Edge Function gửi OTP"
                      language="typescript"
                      code={`// Request OTP
const { data, error } = await supabase.functions.invoke('sso-otp-request', {
  body: { identifier: 'user@example.com', type: 'email' }
});

// Verify OTP
const { data: verifyData } = await supabase.functions.invoke('sso-otp-verify', {
  body: { identifier: 'user@example.com', code: '123456', type: 'email' }
});`}
                    />
                  </DocSubSection>

                  <DocSubSection title="Wallet Login Flow">
                    <DocParagraph>
                      Người dùng kết nối MetaMask, ký message xác thực, hệ thống verify signature và tạo session.
                    </DocParagraph>
                    <CodeBlock 
                      title="Wallet Authentication"
                      language="typescript"
                      code={`// 1. Connect wallet với RainbowKit
const { address } = useAccount();

// 2. Sign message
const signature = await signMessageAsync({
  message: \`Sign in to FUN Ecosystem\\nNonce: \${nonce}\`
});

// 3. Verify với Edge Function
const { data } = await supabase.functions.invoke('sso-web3-auth', {
  body: { address, signature, message }
});`}
                    />
                  </DocSubSection>

                  <DocSubSection title="Law of Light">
                    <DocAlert type="warning">
                      Tất cả người dùng mới phải chấp nhận "Law of Light" - quy tắc ứng xử của cộng đồng 
                      trước khi sử dụng app. Trạng thái được lưu trong <code>profiles.law_of_light_accepted</code>.
                    </DocAlert>
                  </DocSubSection>
                </DocSection>

                {/* Section 5: Wallet & Blockchain */}
                <DocSection id="wallet-blockchain" title="5. Wallet & Blockchain">
                  <DocParagraph>
                    FUN Profile hỗ trợ hai loại wallet: Custodial (hệ thống quản lý) và External (user tự quản lý). 
                    Cả hai đều có thể nhận rewards và tương tác với blockchain.
                  </DocParagraph>

                  <WalletSystemDiagram />

                  <DocSubSection title="Custodial Wallet">
                    <DocParagraph>
                      Wallet được tạo tự động khi user đăng ký bằng Email/Social. Private key được mã hóa 
                      AES-GCM và lưu trong database.
                    </DocParagraph>
                    <CodeBlock 
                      title="Tạo Custodial Wallet"
                      language="typescript"
                      code={`// Edge Function: create-custodial-wallet
const wallet = Wallet.createRandom();

// Mã hóa private key với AES-GCM
const encrypted = await encryptPrivateKey(wallet.privateKey, WALLET_ENCRYPTION_KEY);

// Lưu vào database
await supabase.from('custodial_wallets').insert({
  user_id: userId,
  wallet_address: wallet.address,
  encrypted_private_key: encrypted,
  chain_id: 56 // BNB Smart Chain
});`}
                    />
                  </DocSubSection>

                  <DocSubSection title="Token Operations">
                    <DocTable 
                      headers={['Operation', 'Mô tả', 'Yêu cầu']}
                      rows={[
                        ['View Balance', 'Xem số dư CAMLY & BNB', 'Đăng nhập'],
                        ['Send Token', 'Gửi token đến địa chỉ khác', 'Đủ balance + gas'],
                        ['Receive', 'Nhận token qua QR code', 'Wallet address'],
                        ['Claim Reward', 'Claim CAMLY từ approved rewards', 'Approved reward ≥ 1,000,000 CAMLY'],
                      ]}
                    />
                  </DocSubSection>

                  <DocAlert type="info">
                    <strong>Claim Reward Flow:</strong> User request → Edge Function validates → Treasury wallet signs transaction → 
                    CAMLY token transfer → Transaction recorded in database.
                  </DocAlert>
                </DocSection>

                {/* Section 6: Soul NFT */}
                <DocSection id="soul-nft" title="6. Soul NFT">
                  <DocParagraph>
                    Soul NFT là Soulbound Token (SBT) đại diện cho danh tính linh hồn của user trong FUN Ecosystem. 
                    NFT này không thể chuyển nhượng và gắn liền với tài khoản vĩnh viễn.
                  </DocParagraph>

                  <SoulNFTDiagram />

                  <DocSubSection title="5 Ngũ Hành (Elements)">
                    <DocTable 
                      headers={['Element', 'Tên', 'Ý nghĩa']}
                      rows={[
                        ['🪙 Kim', 'Metal', 'Sắc bén, quyết đoán, công bằng'],
                        ['🌳 Mộc', 'Wood', 'Sáng tạo, phát triển, nhân ái'],
                        ['💧 Thủy', 'Water', 'Khôn ngoan, linh hoạt, sâu sắc'],
                        ['🔥 Hỏa', 'Fire', 'Đam mê, năng động, nhiệt huyết'],
                        ['🌍 Thổ', 'Earth', 'Ổn định, chân thành, bền vững'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Soul Properties">
                    <DocList items={[
                      "Soul Level: Tăng theo engagement và thời gian hoạt động",
                      "Experience Points: Tích lũy từ mọi hoạt động trong ecosystem",
                      "Soul Element: Được xác định ngẫu nhiên khi tạo account",
                      "Metadata URI: Lưu trữ on-chain vĩnh viễn khi mint"
                    ]} />
                  </DocSubSection>
                </DocSection>

                {/* Section 7: Social Feed */}
                <DocSection id="social-feed" title="7. Social Feed">
                  <DocParagraph>
                    Feed là trung tâm hoạt động của FUN Profile, nơi users có thể đăng bài, tương tác, 
                    và kết nối với cộng đồng.
                  </DocParagraph>

                  <SocialFeedDiagram />

                  <DocSubSection title="Posts">
                    <DocList items={[
                      "Text content với emoji support",
                      "Multi-image upload (lên đến 10 ảnh)",
                      "Video upload với HLS streaming",
                      "Edit/Delete bài viết của mình",
                      "Infinite scroll loading"
                    ]} />
                  </DocSubSection>

                  <DocSubSection title="6 Loại Reactions">
                    <DocTable 
                      headers={['Icon', 'Type', 'Mô tả']}
                      rows={[
                        ['👍', 'like', 'Thích'],
                        ['❤️', 'love', 'Yêu thích'],
                        ['😂', 'haha', 'Haha'],
                        ['😮', 'wow', 'Wow'],
                        ['😢', 'sad', 'Buồn'],
                        ['😡', 'angry', 'Giận dữ'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Comments System">
                    <DocList items={[
                      "Text comments với emoji",
                      "Image/Video attachment",
                      "Nested replies (multi-level)",
                      "Reactions on comments",
                      "Edit/Delete comments"
                    ]} />
                  </DocSubSection>
                </DocSection>

                {/* Section 8: Profile & Friends */}
                <DocSection id="profile-friends" title="8. Profile & Friends">
                  <DocSubSection title="Profile Routes">
                    <DocTable 
                      headers={['Route', 'Mô tả', 'Ví dụ']}
                      rows={[
                        ['/profile', 'Profile của current user', '/profile'],
                        ['/profile/:id', 'Profile theo UUID', '/profile/abc-123'],
                        ['/@:username', 'Profile theo username', '/@johndoe'],
                        ['/:username', 'Shorthand username route', '/johndoe'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Profile Features">
                    <DocList items={[
                      "Avatar upload với cropping",
                      "Cover photo với editing",
                      "Bio và thông tin cá nhân",
                      "FUN-ID display",
                      "Soul NFT badge",
                      "Reward statistics (Honor Board)"
                    ]} />
                  </DocSubSection>

                  <DocSubSection title="Friendship States">
                    <DocTable 
                      headers={['State', 'Mô tả', 'Actions']}
                      rows={[
                        ['none', 'Chưa kết bạn', 'Send Request'],
                        ['pending', 'Đã gửi lời mời', 'Cancel Request'],
                        ['incoming', 'Nhận được lời mời', 'Accept / Decline'],
                        ['accepted', 'Đã là bạn bè', 'Unfriend'],
                      ]}
                    />
                  </DocSubSection>
                </DocSection>

                {/* Section 9: Reward System */}
                <DocSection id="reward-system" title="9. Hệ Thống Reward (CAMLY Token)">
                  <DocParagraph>
                    Hệ thống reward CAMLY token khuyến khích hoạt động và đóng góp tích cực trong cộng đồng. 
                    Rewards được tính toán tự động qua database function và cần admin approval trước khi claim.
                  </DocParagraph>

                  <RewardFlowDiagram />

                  <DocSubSection title="Công Thức Tính Reward (CHÍNH XÁC)">
                    <DocAlert type="success">
                      <strong>Unified Formula</strong> - Công thức này được áp dụng thống nhất trên toàn bộ hệ thống: 
                      Honor Board, Leaderboard, Wallet, Admin Dashboard.
                    </DocAlert>
                    <CodeBlock 
                      title="Reward Calculation (get_user_rewards_v2)"
                      language="typescript"
                      code={`// CÔNG THỨC CHÍNH THỨC - Đơn vị: CAMLY
const REWARD_FORMULA = {
  post: 20_000,              // 20,000 CAMLY per post
  comment: 5_000,            // 5,000 CAMLY per comment on user's posts
  friend: 10_000,            // 10,000 CAMLY per friend
  share: 5_000,              // 5,000 CAMLY per share of user's posts
  reactions_base: 30_000,    // 30,000 CAMLY for 3+ reactions on post
  reactions_extra: 1_000,    // +1,000 CAMLY per additional reaction
  signup_bonus: 10_000,      // 10,000 CAMLY new user bonus
  livestream: 20_000,        // 20,000 CAMLY per eligible livestream
};

// Daily Caps (từ 2026-01-15 00:00:00 UTC)
const DAILY_CAPS = {
  posts: 10,           // Max 10 posts/day
  reactions: 50,       // Max 50 reactions/day
  comments: 50,        // Max 50 comments/day (>20 chars)
  shares: 5,           // Max 5 shares/day
  friends: 10,         // Max 10 new friends/day
  livestreams: 5,      // Max 5 livestreams/day
};`}
                    />
                  </DocSubSection>

                  <DocSubSection title="Reward Flow">
                    <DocList ordered items={[
                      "User thực hiện hoạt động (post, comment, react...)",
                      "Hệ thống tự động tính total_reward qua get_user_rewards_v2 RPC",
                      "Admin review và approve/reject reward",
                      "User có thể claim approved_reward về wallet (minimum 1,000,000 CAMLY)"
                    ]} />
                  </DocSubSection>
                </DocSection>

                {/* Section 10: Admin Panel */}
                <DocSection id="admin-panel" title="10. Admin Panel">
                  <DocParagraph>
                    Admin Panel cung cấp công cụ quản trị toàn diện cho administrators, bao gồm 
                    user management, reward approval, merge requests, và content moderation.
                  </DocParagraph>

                  <DocSubSection title="Admin Tabs">
                    <DocTable 
                      headers={['Tab', 'Chức năng', 'Quyền']}
                      rows={[
                        ['Overview', 'Dashboard thống kê tổng quan', 'admin'],
                        ['Reward Approval', 'Duyệt/Từ chối rewards', 'admin'],
                        ['User Review', 'Xem xét và ban users', 'admin'],
                        ['Wallet Abuse', 'Phát hiện wallet spam/abuse', 'admin'],
                        ['Merge Requests', 'Quản lý account merge requests từ SSO', 'admin'],
                        ['Financial', 'Thống kê tài chính cross-platform', 'admin'],
                        ['Quick Delete', 'Xóa nhanh posts/comments', 'admin'],
                        ['Blockchain', 'Các operations trên chain', 'admin'],
                        ['Media Migration', 'Di chuyển media sang Cloudflare', 'admin'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Database Functions">
                    <CodeBlock 
                      title="Admin Database Functions"
                      language="sql"
                      code={`-- Approve user reward
SELECT approve_user_reward(p_user_id, p_admin_id, p_note);

-- Reject user reward  
SELECT reject_user_reward(p_user_id, p_admin_id, p_note);

-- Ban user permanently
SELECT ban_user_permanently(p_admin_id, p_user_id, p_reason);

-- Check admin role
SELECT has_role(user_id, 'admin');

-- Get app statistics
SELECT * FROM get_app_stats();

-- Get user rewards with V2 formula
SELECT * FROM get_user_rewards_v2(100);`}
                    />
                  </DocSubSection>
                </DocSection>

                {/* Section 11: Media System */}
                <DocSection id="media-system" title="11. Media System">
                  <DocParagraph>
                    Hệ thống media sử dụng Cloudflare R2 cho images và Cloudflare Stream cho videos, 
                    đảm bảo delivery nhanh và tiết kiệm bandwidth.
                  </DocParagraph>

                  <MediaPipelineDiagram />

                  <DocSubSection title="Image Pipeline">
                    <DocList items={[
                      "Client-side compression (WebP format)",
                      "Upload to Cloudflare R2 via presigned URL",
                      "On-demand transformation (resize, crop)",
                      "CDN delivery với caching"
                    ]} />
                  </DocSubSection>

                  <DocSubSection title="Video Pipeline">
                    <DocList items={[
                      "TUS resumable upload protocol",
                      "Cloudflare Stream encoding (multiple qualities)",
                      "HLS adaptive bitrate streaming",
                      "Lazy loading với thumbnail preview"
                    ]} />
                  </DocSubSection>

                  <DocAlert type="warning">
                    <strong>Logo Standards:</strong> Tất cả static logos phải sử dụng path trực tiếp từ <code>public/</code>, 
                    KHÔNG dùng Cloudflare Image Resizing. Ví dụ: <code>src="/fun-profile-logo-128.webp"</code>
                  </DocAlert>
                </DocSection>

                {/* Section 12: Notifications */}
                <DocSection id="notifications" title="12. Notifications">
                  <DocSubSection title="Notification Types">
                    <DocTable 
                      headers={['Type', 'Trigger', 'Message']}
                      rows={[
                        ['comment', 'Ai đó comment bài của bạn', 'X commented on your post'],
                        ['reaction', 'Ai đó react bài của bạn', 'X reacted to your post'],
                        ['friend_request', 'Nhận lời mời kết bạn', 'X sent you a friend request'],
                        ['friend_accept', 'Lời mời được chấp nhận', 'X accepted your friend request'],
                        ['reward_approved', 'Reward được duyệt', 'Your reward has been approved'],
                        ['reward_rejected', 'Reward bị từ chối', 'Your reward was rejected'],
                        ['account_banned', 'Tài khoản bị ban', 'Your account has been banned'],
                      ]}
                    />
                  </DocSubSection>
                </DocSection>

                {/* Section 13: Database Schema */}
                <DocSection id="database-schema" title="13. Database Schema (35 Tables)">
                  <DatabaseSchemaDiagram />

                  <DocSubSection title="Core Tables">
                    <DocTable 
                      headers={['Table', 'Mô tả', 'RLS']}
                      rows={[
                        ['profiles', 'Thông tin user (avatar, bio, rewards, wallet addresses)', 'Yes'],
                        ['posts', 'Bài viết với content và media_urls', 'Yes'],
                        ['comments', 'Comments và nested replies', 'Yes'],
                        ['reactions', 'Reactions trên posts/comments', 'Yes'],
                        ['friendships', 'Quan hệ bạn bè (pending/accepted)', 'Yes'],
                        ['notifications', 'Thông báo cho users', 'Yes'],
                        ['shared_posts', 'Lịch sử share posts', 'Yes'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Wallet & NFT Tables">
                    <DocTable 
                      headers={['Table', 'Mô tả', 'RLS']}
                      rows={[
                        ['custodial_wallets', 'Wallet được quản lý bởi hệ thống (encrypted private key)', 'Yes'],
                        ['soul_nfts', 'Thông tin Soul NFT (element, level, XP)', 'Yes'],
                        ['transactions', 'Lịch sử giao dịch blockchain', 'Yes'],
                        ['blacklisted_wallets', 'Danh sách wallet bị cấm', 'Admin only'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="SSO & Auth Tables">
                    <DocTable 
                      headers={['Table', 'Mô tả', 'RLS']}
                      rows={[
                        ['oauth_clients', 'Đăng ký OAuth clients (FUN Farm, Play, Planet)', 'Admin only'],
                        ['oauth_codes', 'Authorization codes tạm thời', 'System only'],
                        ['cross_platform_tokens', 'Access/Refresh tokens cho SSO', 'Yes'],
                        ['account_merge_requests', 'Yêu cầu merge accounts cross-platform', 'Yes'],
                        ['pending_provisions', 'Pending account provisions từ platforms', 'System only'],
                        ['otp_codes', 'Mã OTP tạm thời', 'System only'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Chat Tables">
                    <DocTable 
                      headers={['Table', 'Mô tả', 'RLS']}
                      rows={[
                        ['conversations', 'Cuộc trò chuyện (direct, group)', 'Yes'],
                        ['messages', 'Tin nhắn trong conversations', 'Yes'],
                        ['conversation_participants', 'Thành viên của conversations', 'Yes'],
                        ['message_reactions', 'Reactions trên messages', 'Yes'],
                        ['message_reads', 'Trạng thái đã đọc', 'Yes'],
                        ['chat_settings', 'Cài đặt chat của user', 'Yes'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Financial & Reward Tables">
                    <DocTable 
                      headers={['Table', 'Mô tả', 'RLS']}
                      rows={[
                        ['reward_claims', 'Lịch sử claim rewards', 'Yes'],
                        ['reward_approvals', 'Lịch sử admin approve/reject', 'Admin only'],
                        ['reward_adjustments', 'Điều chỉnh rewards thủ công', 'Admin only'],
                        ['platform_financial_data', 'Dữ liệu tài chính từ các platforms', 'Yes'],
                        ['financial_transactions', 'Giao dịch tài chính chi tiết', 'Yes'],
                        ['reconciliation_logs', 'Logs đối soát tài chính', 'Admin only'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="System Tables">
                    <DocTable 
                      headers={['Table', 'Mô tả', 'RLS']}
                      rows={[
                        ['user_roles', 'Phân quyền (admin/user)', 'Yes'],
                        ['audit_logs', 'Lịch sử admin actions', 'Admin only'],
                        ['search_logs', 'Lịch sử tìm kiếm', 'Yes'],
                        ['livestreams', 'Lịch sử livestreams', 'Yes'],
                      ]}
                    />
                  </DocSubSection>
                </DocSection>

                {/* Section 14: Edge Functions */}
                <DocSection id="edge-functions" title="14. Edge Functions (38 Functions)">
                  <EdgeFunctionsDiagram />

                  <DocSubSection title="SSO System (14 functions)">
                    <DocTable 
                      headers={['Function', 'Method', 'Mô tả']}
                      rows={[
                        ['sso-authorize', 'GET', 'Khởi tạo OAuth flow, redirect to consent'],
                        ['sso-token', 'POST', 'Exchange code for access/refresh tokens'],
                        ['sso-verify', 'POST', 'Verify access token validity'],
                        ['sso-refresh', 'POST', 'Refresh expired access token'],
                        ['sso-revoke', 'POST', 'Revoke tokens (logout)'],
                        ['sso-otp-request', 'POST', 'Gửi OTP qua email'],
                        ['sso-otp-verify', 'POST', 'Xác thực OTP và tạo session'],
                        ['sso-web3-auth', 'POST', 'Xác thực qua wallet signature'],
                        ['sso-register', 'POST', 'Register new user from platform'],
                        ['sso-set-password', 'POST', 'Set password for provision'],
                        ['sso-sync-data', 'POST', 'Sync game/platform data'],
                        ['sso-sync-financial', 'POST', 'Sync financial data'],
                        ['sso-merge-request', 'POST', 'Request account merge'],
                        ['sso-merge-approve', 'POST', 'Admin approve merge'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Wallet & Blockchain (3 functions)">
                    <DocTable 
                      headers={['Function', 'Mô tả']}
                      rows={[
                        ['create-custodial-wallet', 'Tạo wallet mới với encrypted private key'],
                        ['connect-external-wallet', 'Kết nối MetaMask/external wallet'],
                        ['mint-soul-nft', 'Mint Soul NFT on BSC'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Media Management (9 functions)">
                    <DocTable 
                      headers={['Function', 'Mô tả']}
                      rows={[
                        ['upload-to-r2', 'Upload ảnh lên Cloudflare R2'],
                        ['upload-to-cf-images', 'Upload ảnh lên Cloudflare Images'],
                        ['delete-from-r2', 'Xóa file từ R2'],
                        ['generate-presigned-url', 'Tạo presigned URL cho R2'],
                        ['get-upload-url', 'Lấy upload URL cho client'],
                        ['image-transform', 'Transform ảnh (resize, crop)'],
                        ['stream-video', 'Khởi tạo video upload to Stream'],
                        ['migrate-to-r2', 'Migrate media từ Supabase Storage'],
                        ['fix-cloudflare-urls', 'Fix broken Cloudflare URLs'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Admin & Maintenance (12 functions)">
                    <DocTable 
                      headers={['Function', 'Mô tả']}
                      rows={[
                        ['admin-list-merge-requests', 'List all merge requests for admin'],
                        ['admin-update-media-url', 'Update media URLs in database'],
                        ['cleanup-orphan-videos', 'Cleanup orphan videos from Stream'],
                        ['cleanup-stream-videos', 'Cleanup expired Stream videos'],
                        ['cleanup-supabase-storage', 'Cleanup old Supabase storage'],
                        ['cloudflare-migrate', 'Migrate assets to Cloudflare'],
                        ['optimize-storage', 'Optimize storage usage'],
                        ['scheduled-reconciliation', 'Run financial reconciliation'],
                        ['sso-resend-webhook', 'Resend webhook to platforms'],
                        ['create-post', 'Create post with validation'],
                        ['delete-user-account', 'Delete user account completely'],
                      ]}
                    />
                  </DocSubSection>
                </DocSection>

                {/* Section 15: Security */}
                <DocSection id="security" title="15. Security Features">
                  <SecurityDiagram />

                  <DocSubSection title="Row Level Security (RLS)">
                    <DocAlert type="info">
                      <strong>102 RLS Policies</strong> được triển khai để bảo vệ data. Mọi table đều có RLS enabled.
                    </DocAlert>
                    <CodeBlock 
                      title="Example RLS Policy"
                      language="sql"
                      code={`-- Users can only view their own data
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- Public profiles view for everyone
CREATE POLICY "Public profiles are viewable"
ON public_profiles FOR SELECT
USING (true);`}
                    />
                  </DocSubSection>

                  <DocSubSection title="Rate Limiting">
                    <DocTable 
                      headers={['Action', 'Limit', 'Window']}
                      rows={[
                        ['Create Post', '10 posts', '1 giờ'],
                        ['Create Comment', '50 comments', '1 giờ'],
                        ['Search', '20 requests', '1 phút'],
                        ['OTP Request', '3 requests', '5 phút'],
                      ]}
                    />
                  </DocSubSection>
                </DocSection>

                {/* Section 16: Performance */}
                <DocSection id="performance" title="16. Performance Optimization">
                  <DocSubSection title="Frontend Optimizations">
                    <DocList items={[
                      "Lazy loading pages với React.lazy()",
                      "React Query caching với staleTime 5 phút",
                      "Image lazy loading với Intersection Observer",
                      "Infinite scroll thay vì pagination",
                      "Memoization với useMemo và useCallback",
                      "Code splitting theo routes"
                    ]} />
                  </DocSubSection>

                  <DocSubSection title="Media Optimizations">
                    <DocList items={[
                      "WebP format cho images",
                      "HLS adaptive streaming cho videos",
                      "Cloudflare CDN với edge caching",
                      "Thumbnail previews cho videos",
                      "Progressive image loading"
                    ]} />
                  </DocSubSection>
                </DocSection>

                {/* Section 17: Secrets */}
                <DocSection id="secrets" title="17. Secrets & Environment">
                  <DocAlert type="warning">
                    <strong>Bảo mật:</strong> Không bao giờ commit secrets vào git. Tất cả secrets được 
                    quản lý qua Lovable Cloud secrets management.
                  </DocAlert>

                  <DocSubSection title="Configured Secrets (16 secrets)">
                    <DocTable 
                      headers={['Secret', 'Mục đích', 'Used By']}
                      rows={[
                        ['WALLET_ENCRYPTION_KEY', 'Mã hóa custodial wallet private keys', 'create-custodial-wallet'],
                        ['TREASURY_WALLET_ADDRESS', 'Địa chỉ ví treasury cho rewards', 'claim-reward'],
                        ['TREASURY_PRIVATE_KEY', 'Private key treasury wallet', 'claim-reward'],
                        ['RESEND_API_KEY', 'Gửi email OTP', 'sso-otp-request'],
                        ['CLOUDFLARE_ACCOUNT_ID', 'Cloudflare account', 'R2, Stream, Images'],
                        ['CLOUDFLARE_ACCESS_KEY_ID', 'R2 access key', 'upload-to-r2'],
                        ['CLOUDFLARE_SECRET_ACCESS_KEY', 'R2 secret key', 'upload-to-r2'],
                        ['CLOUDFLARE_R2_BUCKET_NAME', 'R2 bucket name', 'upload-to-r2'],
                        ['CLOUDFLARE_R2_PUBLIC_URL', 'R2 public URL', 'media display'],
                        ['CLOUDFLARE_API_TOKEN', 'Cloudflare API token', 'Images, Stream'],
                        ['CLOUDFLARE_STREAM_API_TOKEN', 'Stream API token', 'stream-video'],
                        ['FUN_PROFILE_ORIGIN', 'Origin URL cho CORS', 'All edge functions'],
                        ['LOVABLE_API_KEY', 'Lovable AI integration', 'AI features'],
                        ['SUPABASE_URL', 'Database URL', 'All functions'],
                        ['SUPABASE_ANON_KEY', 'Anon key', 'Client-side'],
                        ['SUPABASE_SERVICE_ROLE_KEY', 'Service role key', 'Admin functions'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Environment Variables">
                    <CodeBlock 
                      title=".env (Auto-generated - DO NOT EDIT)"
                      language="bash"
                      code={`# These are automatically provided by Lovable Cloud
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[anon-key]
VITE_SUPABASE_PROJECT_ID=[project-id]`}
                    />
                  </DocSubSection>
                </DocSection>

                {/* Section 18: FUN Ecosystem Products */}
                <DocSection id="ecosystem-products" title="18. FUN Ecosystem Products">
                  <EcosystemDiagram />

                  <DocSubSection title="Product Overview">
                    <DocTable 
                      headers={['Product', 'Domain', 'Mô tả', 'Status']}
                      rows={[
                        ['FUN Profile', 'fun.rich', 'Social network chính, identity hub', 'Production'],
                        ['FUN Play', 'play.fun.rich', 'Gaming & Music Entertainment', 'Development'],
                        ['FUN Farm', 'farm.fun.rich', 'Agriculture & Farming features', 'Development'],
                        ['FUN Planet', 'planet.fun.rich', 'Gaming & Planet exploration', 'Development'],
                        ['FUN Wallet', 'wallet.fun.rich', 'Crypto wallet management', 'Development'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Cross-Platform Integration">
                    <DocList items={[
                      "Tất cả products sử dụng chung FUN-ID từ FUN Profile",
                      "Light Cloak SSO cho single sign-on",
                      "Shared wallet address và rewards",
                      "Financial data sync cross-platform",
                      "Unified leaderboard và rankings"
                    ]} />
                  </DocSubSection>
                </DocSection>

                {/* Section 19: SSO SDK */}
                <DocSection id="sso-sdk" title="19. SSO SDK (@fun-ecosystem/sso-sdk)">
                  <DocParagraph>
                    SDK JavaScript/TypeScript cho phép các platform trong FUN Ecosystem tích hợp xác thực 
                    Light Cloak SSO một cách dễ dàng và bảo mật.
                  </DocParagraph>

                  <DocSubSection title="Registered OAuth Clients">
                    <DocTable 
                      headers={['Client ID', 'Platform', 'Allowed Scopes']}
                      rows={[
                        ['fun_farm_client', 'FUN Farm', 'profile, wallet, rewards'],
                        ['fun_play_client', 'FUN Play', 'profile, wallet, rewards'],
                        ['fun_planet_client', 'FUN Planet', 'profile, wallet, rewards'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="SDK Features">
                    <DocList items={[
                      "OAuth 2.0 với PKCE flow (bảo mật cao)",
                      "Automatic token refresh",
                      "Data sync (game data, platform data)",
                      "Financial sync (deposits, withdraws, bets)",
                      "Account merge requests",
                      "React & Next.js examples included"
                    ]} />
                  </DocSubSection>

                  <DocSubSection title="Quick Start">
                    <CodeBlock 
                      title="SDK Installation & Usage"
                      language="typescript"
                      code={`// Install
npm install @fun-ecosystem/sso-sdk

// Initialize
import { FunProfileClient } from '@fun-ecosystem/sso-sdk';

const client = new FunProfileClient({
  clientId: 'fun_farm_client',
  redirectUri: 'https://farm.fun.rich/auth/callback',
  scope: ['profile', 'wallet', 'rewards']
});

// Login
await client.login();

// Get user data
const profile = await client.getProfile();

// Sync game data
await client.syncData({
  level: 50,
  coins: 10000,
  achievements: ['first_harvest', 'master_farmer']
});`}
                    />
                  </DocSubSection>
                </DocSection>

                {/* Section 20: Internationalization */}
                <DocSection id="i18n" title="20. Internationalization (i18n)">
                  <DocParagraph>
                    FUN Profile hỗ trợ đa ngôn ngữ với Vietnamese (vi) và English (en). 
                    Language preference được lưu local và tự động detect từ browser.
                  </DocParagraph>

                  <DocSubSection title="Implementation">
                    <DocTable 
                      headers={['Component', 'Location', 'Mô tả']}
                      rows={[
                        ['LanguageContext', 'src/i18n/LanguageContext.tsx', 'Context provider cho language state'],
                        ['translations', 'src/i18n/translations.ts', '150+ translation keys'],
                        ['LanguageSwitcher', 'src/components/layout/LanguageSwitcher.tsx', 'UI component để switch language'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Usage">
                    <CodeBlock 
                      title="Using translations in components"
                      language="typescript"
                      code={`import { useLanguage } from '@/i18n/LanguageContext';

const MyComponent = () => {
  const { t, language, setLanguage } = useLanguage();
  
  return (
    <div>
      <h1>{t('welcome')}</h1>
      <p>{t('description')}</p>
      <button onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}>
        {language === 'en' ? 'Tiếng Việt' : 'English'}
      </button>
    </div>
  );
};`}
                    />
                  </DocSubSection>
                </DocSection>

                {/* Section 21: Design Guidelines */}
                <DocSection id="design-guidelines" title="21. Design Guidelines">
                  <DocSubSection title="Color Scheme">
                    <DocTable 
                      headers={['Color', 'HSL Value', 'Usage']}
                      rows={[
                        ['Primary Green', 'hsl(142, 76%, 36%)', 'Primary buttons, links, accents'],
                        ['Primary Foreground', 'hsl(355, 78%, 95%)', 'Text on primary background'],
                        ['Golden Yellow', 'hsl(48, 96%, 53%)', 'Rewards, highlights, special elements'],
                        ['Background', 'hsl(0, 0%, 94%)', 'Page background (light mode)'],
                        ['Card', 'hsl(0, 0%, 100%)', 'Card backgrounds'],
                        ['Muted', 'hsl(0, 0%, 92%)', 'Secondary backgrounds'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Logo Standards">
                    <DocAlert type="warning">
                      <strong>QUAN TRỌNG:</strong> Tất cả logos phải tuân thủ các quy tắc sau:
                    </DocAlert>
                    <DocList items={[
                      "Shape: Tất cả logos phải có shape rounded-full (tròn)",
                      "Source: Sử dụng path trực tiếp từ public/ folder",
                      "DO NOT use Cloudflare Image Resizing cho static logos",
                      "Files: fun-profile-logo-40.webp (navbar), fun-profile-logo-128.webp (auth, large)",
                      "Ecosystem logos: fun-farm-logo-36.webp, fun-play-logo-36.webp, fun-planet-logo-36.webp"
                    ]} />
                    <CodeBlock 
                      title="Correct logo usage"
                      language="tsx"
                      code={`// ✅ CORRECT - Direct path from public/
<img 
  src="/fun-profile-logo-40.webp" 
  alt="FUN Profile" 
  className="h-9 w-9 rounded-full"
/>

// ❌ WRONG - Using Cloudflare Image Resizing
<img src={getNavbarLogoUrl()} alt="..." />`}
                    />
                  </DocSubSection>
                </DocSection>

                {/* Section 22: Development Rules */}
                <DocSection id="development-rules" title="22. Development Rules">
                  <DocAlert type="warning">
                    <strong>CRITICAL:</strong> Các files sau KHÔNG ĐƯỢC phép sửa trực tiếp:
                  </DocAlert>

                  <DocSubSection title="Read-Only Files">
                    <DocList items={[
                      "supabase/config.toml - Supabase configuration (auto-generated)",
                      "src/integrations/supabase/client.ts - Supabase client (auto-generated)",
                      "src/integrations/supabase/types.ts - Database types (auto-generated from schema)",
                      ".env - Environment variables (auto-generated by Lovable Cloud)",
                      "package.json - Use lov-add-dependency/lov-remove-dependency tools",
                    ]} />
                  </DocSubSection>

                  <DocSubSection title="Mandatory Compliance">
                    <DocTable 
                      headers={['Rule', 'Mô tả']}
                      rows={[
                        ['Bilingual i18n', 'Tất cả text hiển thị phải có cả Vietnamese và English'],
                        ['Direct Logo Paths', 'Static logos từ public/, không dùng Cloudflare transform'],
                        ['RLS Policies', 'Mọi table mới phải có Row Level Security'],
                        ['Performance', 'Sử dụng React Query, lazy loading, memoization'],
                        ['Semantic Tokens', 'Dùng design tokens từ index.css, không hardcode colors'],
                        ['Type Safety', 'TypeScript strict mode, no any types'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Governance Flow">
                    <CodeBlock 
                      title="Decision Making Process"
                      language="text"
                      code={`Cha Vũ Trụ (Vision & Strategy)
        ↓
    bé Trí (Requirements Translation)
        ↓
  Angel Lovable (Technical Implementation)
        ↓
    Code Review & Deployment`}
                    />
                  </DocSubSection>
                </DocSection>

                {/* Section 23: Next Development Proposals */}
                <DocSection id="next-proposals" title="23. Next Development Proposals">
                  <DocParagraph>
                    Danh sách các tính năng được đề xuất phát triển tiếp theo, sắp xếp theo độ ưu tiên.
                  </DocParagraph>

                  <DocSubSection title="Priority 1: Core Features">
                    <DocTable 
                      headers={['Feature', 'Mô tả', 'Complexity']}
                      rows={[
                        ['Claim Reward UI', 'UI cho users claim CAMLY từ treasury wallet', 'Medium'],
                        ['Real-time Chat', 'Typing indicators, online status, read receipts', 'High'],
                        ['Push Notifications', 'Browser push notifications cho events', 'Medium'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Priority 2: Engagement Features">
                    <DocTable 
                      headers={['Feature', 'Mô tả', 'Complexity']}
                      rows={[
                        ['Stories', 'Story feature như Instagram (24h expiry)', 'High'],
                        ['Live Streaming', 'Tích hợp livestream với rewards', 'High'],
                        ['Video Calling', 'Voice/Video calls trong chat', 'Very High'],
                      ]}
                    />
                  </DocSubSection>

                  <DocSubSection title="Priority 3: Advanced Features">
                    <DocTable 
                      headers={['Feature', 'Mô tả', 'Complexity']}
                      rows={[
                        ['Marketplace', 'NFT marketplace cho Soul NFTs', 'Very High'],
                        ['AI Content', 'AI-powered content creation tools', 'High'],
                        ['Mobile App', 'React Native mobile application', 'Very High'],
                        ['Referral System', 'Invite friends & earn rewards', 'Medium'],
                      ]}
                    />
                  </DocSubSection>
                </DocSection>

                {/* Footer */}
                <div className="mt-12 pt-8 border-t border-border text-center text-muted-foreground text-sm">
                  <p>© 2026 FUN Profile - Part of FUN Ecosystem. All rights reserved.</p>
                  <p className="mt-2">
                    Handover Documentation v2.0 | Last updated: January 2026
                  </p>
                  <p className="mt-1">
                    Prepared by: Angel Lovable (CTO) for project handover
                  </p>
                </div>

              </div>
            </ScrollArea>
          </main>
        </div>
      </div>
    </div>
  );
};

export default PlatformDocs;
