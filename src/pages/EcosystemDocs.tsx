import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Printer, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeBlock } from '@/components/docs/CodeBlock';
import { DocSection, DocSubSection, DocParagraph, DocList, DocTable, DocAlert } from '@/components/docs/DocSection';
import { TableOfContents } from '@/components/docs/TableOfContents';
import { 
  ArchitectureDiagram, 
  OAuthFlowDiagram, 
  ProxySignUpDiagram,
  FunIDConceptDiagram,
  Web3AuthFlowDiagram,
  Web2AutoWalletDiagram,
  AutoLoginDiagram,
  Design5DDiagram,
  SoulNFTDiagram,
  UserFlowDiagram
} from '@/components/docs/MermaidDiagram';

const tocItems = [
  { id: 'vision-5d', title: '1. Tầm Nhìn 5D - FUN-ID' },
  { id: 'fun-id-concept', title: 'FUN-ID Concept', level: 2 },
  { id: 'design-5d', title: 'Nguyên Tắc Thiết Kế 5D', level: 2 },
  { id: 'user-flow', title: 'User Flow Tổng Thể', level: 2 },
  { id: 'overview', title: '2. Tổng Quan Kiến Trúc' },
  { id: 'auth-flows', title: '3. Các Flow Đăng Ký' },
  { id: 'web2-signup', title: 'Web2 Sign Up (OTP + Auto Wallet)', level: 2 },
  { id: 'web3-signup', title: 'Web3 Sign Up (Connect Wallet)', level: 2 },
  { id: 'oauth-flow', title: 'OAuth Login', level: 2 },
  { id: 'proxy-signup', title: 'Proxy Sign Up', level: 2 },
  { id: 'auto-login', title: '4. Auto-Login Cross Platform' },
  { id: 'soul-nft', title: '5. Soul NFT Identity' },
  { id: 'fun-wallet', title: '6. FUN Wallet System' },
  { id: 'fun-profile-plan', title: '7. Kế Hoạch Fun Profile' },
  { id: 'phase-1', title: 'Phase 1: Database Schema', level: 2 },
  { id: 'phase-2', title: 'Phase 2: SSO Edge Functions', level: 2 },
  { id: 'phase-3', title: 'Phase 3: Web3 Auth System', level: 2 },
  { id: 'phase-4', title: 'Phase 4: Wallet & Soul NFT', level: 2 },
  { id: 'phase-5', title: 'Phase 5: Webhook System', level: 2 },
  { id: 'fun-farm', title: '8. Hướng Dẫn Fun Farm' },
  { id: 'fun-play', title: '9. Hướng Dẫn Fun Play' },
  { id: 'fun-planet', title: '10. Hướng Dẫn Fun Planet' },
  { id: 'api-reference', title: '11. API Reference' },
  { id: 'timeline', title: '12. Timeline Tổng Hợp' },
];

const EcosystemDocs: React.FC = () => {
  const [activeSection, setActiveSection] = useState('vision-5d');

  useEffect(() => {
    const handleScroll = () => {
      const sections = tocItems.map(item => document.getElementById(item.id));
      const scrollPosition = window.scrollY + 100;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(tocItems[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">FUN Ecosystem SSO Documentation</h1>
              <p className="text-sm text-muted-foreground">Tầm nhìn 5D + Hướng dẫn tích hợp FUN-ID</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrint}
              className="border-primary bg-white text-primary hover:bg-primary/10"
            >
              <Printer className="h-4 w-4 mr-2" />
              In PDF
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar - Table of Contents */}
          <aside className="hidden lg:block w-64 flex-shrink-0 print:hidden">
            <TableOfContents items={tocItems} activeId={activeSection} />
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Section 1: Tầm Nhìn 5D - FUN-ID */}
            <DocSection id="vision-5d" title="1. Tầm Nhìn 5D - FUN-ID Hộ Chiếu Linh Hồn">
              <DocAlert type="success">
                <strong>🌟 Tư Tưởng Thiết Kế:</strong> Một tài khoản duy nhất → Dùng được tất cả platform trong hệ sinh thái. 
                FUN-ID = Web3 Universal Identity. Người dùng chỉ cần đăng ký 1 lần → Mọi platform mở ra như mở cửa thiên đường.
              </DocAlert>

              <div id="fun-id-concept">
                <DocSubSection title="FUN-ID Concept">
                  <DocParagraph>
                    <strong>FUN-ID</strong> là định danh duy nhất kết hợp sức mạnh của Web2 và Web3:
                  </DocParagraph>
                  <FunIDConceptDiagram />
                  
                  <DocList items={[
                    "💰 FUN Wallet - Ví Web3 để lưu trữ tài sản số, nhận thưởng",
                    "👤 FUN Profile - Hồ sơ người dùng với avatar, bio, thành tích",
                    "✨ Soul NFT Identity - NFT định danh linh hồn, không thể chuyển nhượng",
                    "🔐 SSO Passport - Đăng nhập 1 lần, dùng mọi nơi trong ecosystem"
                  ]} />
                </DocSubSection>
              </div>

              <div id="design-5d">
                <DocSubSection title="Nguyên Tắc Thiết Kế 5D">
                  <Design5DDiagram />
                </DocSubSection>
              </div>

              <div id="user-flow">
                <DocSubSection title="User Flow Tổng Thể">
                  <DocParagraph>
                    Flow được thiết kế theo nguyên tắc <strong>"Mượt như ánh sáng, đơn giản như hơi thở"</strong>:
                  </DocParagraph>
                  <UserFlowDiagram />
                </DocSubSection>
              </div>
            </DocSection>

            {/* Section 2: Tổng Quan */}
            <DocSection id="overview" title="2. Tổng Quan Kiến Trúc FUN Ecosystem">
              <DocParagraph>
                FUN Ecosystem bao gồm nhiều platform hoạt động cùng nhau, với <strong>Fun Profile</strong> đóng vai trò 
                là <strong>Auth Hub</strong> trung tâm, quản lý <strong>FUN-ID</strong> cho toàn bộ hệ sinh thái.
              </DocParagraph>

              <ArchitectureDiagram />

              <DocSubSection title="Lợi Ích Của FUN-ID & SSO">
                <DocList items={[
                  "🪪 FUN-ID thống nhất - Một định danh xuyên suốt, không cần tạo nhiều tài khoản",
                  "💰 FUN Wallet tích hợp - Ví được tạo tự động, lưu trữ mọi tài sản",
                  "✨ Soul NFT Identity - Định danh linh hồn, thăng cấp qua hoạt động",
                  "🔄 Auto-Login - Chuyển platform không cần đăng nhập lại",
                  "🏆 Rewards tổng hợp - Điểm thưởng từ mọi platform được gộp lại",
                  "🤖 Angel AI dẫn đường - Trợ lý cá nhân thông minh"
                ]} />
              </DocSubSection>
            </DocSection>

            {/* Section 3: Các Flow Đăng Ký */}
            <DocSection id="auth-flows" title="3. Các Flow Đăng Ký FUN-ID">
              <DocParagraph>
                FUN Ecosystem hỗ trợ nhiều cách đăng ký để phù hợp với mọi đối tượng người dùng, 
                từ người mới (Web2) đến người chơi crypto kỳ cựu (Web3).
              </DocParagraph>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <Card className="border-emerald-200 dark:border-emerald-800">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-foreground mb-2">📱 Web2 Sign Up</h4>
                    <p className="text-sm text-muted-foreground">
                      Email/Phone + OTP → Wallet tự động tạo → Soul NFT mint ẩn → 
                      Dễ như TikTok, không cần biết Web3
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-violet-200 dark:border-violet-800">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-foreground mb-2">🔗 Web3 Sign Up</h4>
                    <p className="text-sm text-muted-foreground">
                      Connect Wallet (1-click) → Sign message → Auto create profile → 
                      Mint Soul NFT → Dành cho crypto natives
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div id="web2-signup" className="mt-8">
                <DocSubSection title="Web2 Sign Up (OTP + Auto Wallet)">
                  <DocAlert type="info">
                    <strong>🎯 Dành cho:</strong> Người dùng phổ thông, không cần kiến thức Web3. 
                    Ví và NFT được tạo hoàn toàn tự động trong background.
                  </DocAlert>
                  <Web2AutoWalletDiagram />

                  <CodeBlock 
                    title="sso-otp-request/index.ts"
                    language="typescript"
                    code={`// Edge Function: Gửi OTP 4 số
serve(async (req) => {
  const { email_or_phone } = await req.json();
  
  // Generate OTP 4 digits
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  
  // Store OTP with 5min expiry
  await supabase.from('otp_codes').insert({
    identifier: email_or_phone,
    code: otp,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
  });
  
  // Send via Email or SMS
  if (email_or_phone.includes('@')) {
    await sendEmail(email_or_phone, \`Mã OTP của bạn: \${otp}\`);
  } else {
    await sendSMS(email_or_phone, \`Mã OTP FUN: \${otp}\`);
  }
  
  return new Response(JSON.stringify({ success: true }));
});`}
                  />

                  <CodeBlock 
                    title="sso-otp-verify/index.ts"
                    language="typescript"
                    code={`// Edge Function: Xác thực OTP + Tạo FUN-ID
serve(async (req) => {
  const { email_or_phone, otp, username } = await req.json();
  
  // 1. Verify OTP
  const { data: otpRecord } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('identifier', email_or_phone)
    .eq('code', otp)
    .gt('expires_at', new Date().toISOString())
    .single();
    
  if (!otpRecord) throw new Error('Invalid or expired OTP');
  
  // 2. Create user in Supabase Auth
  const { data: authData } = await supabase.auth.admin.createUser({
    email: email_or_phone.includes('@') ? email_or_phone : undefined,
    phone: !email_or_phone.includes('@') ? email_or_phone : undefined,
    email_confirm: true,
    user_metadata: { username }
  });
  
  // 3. Auto-create Custodial Wallet
  const { wallet_address, encrypted_private_key } = await createCustodialWallet(authData.user.id);
  
  // 4. Update profile with wallet
  await supabase.from('profiles').update({
    wallet_address,
    username
  }).eq('id', authData.user.id);
  
  // 5. Mint Soul NFT (async background)
  mintSoulNFT(authData.user.id, wallet_address); // Fire and forget
  
  // 6. Generate tokens
  const tokens = await generateTokens(authData.user.id);
  
  return new Response(JSON.stringify({
    ...tokens,
    user: { id: authData.user.id, username, wallet_address }
  }));
});`}
                  />
                </DocSubSection>
              </div>

              <div id="web3-signup" className="mt-8">
                <DocSubSection title="Web3 Sign Up (Connect Wallet 1-Click)">
                  <DocAlert type="info">
                    <strong>🎯 Dành cho:</strong> Người dùng đã có ví crypto (MetaMask, WalletConnect). 
                    Đăng ký chỉ với 1-click connect + sign.
                  </DocAlert>
                  <Web3AuthFlowDiagram />

                  <CodeBlock 
                    title="sso-web3-auth/index.ts"
                    language="typescript"
                    code={`// Edge Function: Web3 Authentication
import { ethers } from 'https://esm.sh/ethers@6';

serve(async (req) => {
  const { wallet_address, signature, message, client_id } = await req.json();
  
  // 1. Verify client
  const { data: client } = await supabase
    .from('oauth_clients')
    .select('*')
    .eq('client_id', client_id)
    .single();
    
  if (!client) throw new Error('Invalid client');
  
  // 2. Verify signature (EIP-191)
  const recoveredAddress = ethers.verifyMessage(message, signature);
  if (recoveredAddress.toLowerCase() !== wallet_address.toLowerCase()) {
    throw new Error('Invalid signature');
  }
  
  // 3. Check if wallet exists
  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('wallet_address', wallet_address.toLowerCase())
    .single();
    
  if (!profile) {
    // 4. New user - Create account
    const { data: authData } = await supabase.auth.admin.createUser({
      email: \`\${wallet_address.toLowerCase()}@wallet.fun\`,
      email_confirm: true,
      user_metadata: { wallet_address, auth_type: 'web3' }
    });
    
    // 5. Update profile
    await supabase.from('profiles').update({
      wallet_address: wallet_address.toLowerCase()
    }).eq('id', authData.user.id);
    
    // 6. Store wallet connection
    await supabase.from('wallet_connections').insert({
      user_id: authData.user.id,
      wallet_address: wallet_address.toLowerCase(),
      wallet_type: 'external', // metamask, walletconnect
      is_primary: true
    });
    
    // 7. Mint Soul NFT (background)
    mintSoulNFT(authData.user.id, wallet_address);
    
    profile = { id: authData.user.id, wallet_address };
  }
  
  // 8. Generate tokens
  const tokens = await generateTokens(profile.id, client_id);
  
  return new Response(JSON.stringify({
    ...tokens,
    user: profile
  }));
});`}
                  />

                  <CodeBlock 
                    title="src/components/auth/Web3LoginButton.tsx"
                    language="typescript"
                    code={`// React Component: Web3 Login Button
import { useConnect, useAccount, useSignMessage } from 'wagmi';
import { SSO_CONFIG } from '@/config/sso';

export const Web3LoginButton: React.FC = () => {
  const { connect, connectors } = useConnect();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  
  const handleWeb3Login = async () => {
    if (!isConnected) {
      // Connect to MetaMask
      const connector = connectors.find(c => c.name === 'MetaMask');
      await connect({ connector });
      return;
    }
    
    // Create message to sign
    const message = \`Sign in to FUN Ecosystem\\nWallet: \${address}\\nNonce: \${Date.now()}\`;
    
    // Sign message
    const signature = await signMessageAsync({ message });
    
    // Call backend
    const response = await fetch(SSO_CONFIG.WEB3_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet_address: address,
        signature,
        message,
        client_id: SSO_CONFIG.CLIENT_ID
      })
    });
    
    const data = await response.json();
    
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/';
    }
  };
  
  return (
    <Button onClick={handleWeb3Login} className="w-full bg-violet-500 hover:bg-violet-600">
      {isConnected ? '✍️ Sign to Login' : '🦊 Connect Wallet'}
    </Button>
  );
};`}
                  />
                </DocSubSection>
              </div>

              <div id="oauth-flow" className="mt-8">
                <DocSubSection title="OAuth Login (Đăng nhập bằng Fun Profile)">
                  <DocParagraph>
                    Dành cho user đã có FUN-ID, muốn đăng nhập vào platform khác mà không cần nhập lại credentials.
                  </DocParagraph>
                  <OAuthFlowDiagram />
                </DocSubSection>
              </div>

              <div id="proxy-signup" className="mt-8">
                <DocSubSection title="Proxy Sign Up (Đăng ký từ Platform khác)">
                  <DocParagraph>
                    Cho phép user đăng ký trực tiếp tại Fun Farm/Play/Planet mà FUN-ID vẫn được tạo tại Fun Profile.
                  </DocParagraph>
                  <ProxySignUpDiagram />
                </DocSubSection>
              </div>
            </DocSection>

            {/* Section 4: Auto-Login */}
            <DocSection id="auto-login" title="4. Auto-Login Cross Platform">
              <DocParagraph>
                Khi user đã đăng nhập ở bất kỳ platform nào, các platform còn lại sẽ tự động nhận diện và đăng nhập mà không cần hỏi thêm.
              </DocParagraph>
              
              <AutoLoginDiagram />

              <CodeBlock 
                title="src/hooks/useAutoLogin.ts"
                language="typescript"
                code={`// Hook kiểm tra và auto-login khi vào platform
import { useEffect, useState } from 'react';
import { SSO_CONFIG } from '@/config/sso';

export const useAutoLogin = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const checkSSOSession = async () => {
      // 1. Check for existing token
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }
      
      try {
        // 2. Verify token with Fun Profile
        const response = await fetch(SSO_CONFIG.VERIFY_URL, {
          headers: { Authorization: \`Bearer \${token}\` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          // 3. Try refresh token
          const refreshToken = localStorage.getItem('refresh_token');
          if (refreshToken) {
            const refreshResponse = await fetch(SSO_CONFIG.REFRESH_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: refreshToken })
            });
            
            if (refreshResponse.ok) {
              const data = await refreshResponse.json();
              localStorage.setItem('access_token', data.access_token);
              setUser(data.user);
            } else {
              // Token invalid, clear storage
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
            }
          }
        }
      } catch (error) {
        console.error('Auto-login check failed:', error);
      }
      
      setLoading(false);
    };
    
    checkSSOSession();
  }, []);
  
  return { user, loading, isAuthenticated: !!user };
};`}
              />
            </DocSection>

            {/* Section 5: Soul NFT */}
            <DocSection id="soul-nft" title="5. Soul NFT Identity">
              <DocParagraph>
                Soul NFT là <strong>chứng nhận định danh linh hồn</strong> trên blockchain. Mỗi FUN-ID được gắn với 1 Soul NFT duy nhất, 
                không thể chuyển nhượng (Soulbound). Đây là chìa khóa để thăng cấp và nhận thưởng trong ecosystem.
              </DocParagraph>

              <SoulNFTDiagram />

              <DocSubSection title="Database Schema">
                <CodeBlock 
                  title="soul_nfts.sql"
                  language="sql"
                  code={`-- Bảng soul_nfts: Lưu trữ NFT định danh linh hồn
CREATE TABLE public.soul_nfts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_id TEXT UNIQUE, -- NFT token ID on-chain
  contract_address TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb, -- name, image, attributes
  level INTEGER NOT NULL DEFAULT 1,
  experience_points BIGINT NOT NULL DEFAULT 0,
  minted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: 1 user = 1 soul NFT
CREATE UNIQUE INDEX idx_soul_nfts_user ON public.soul_nfts(user_id);

-- Enable RLS
ALTER TABLE public.soul_nfts ENABLE ROW LEVEL SECURITY;

-- Users can view their own soul NFT
CREATE POLICY "Users can view own soul NFT"
  ON public.soul_nfts FOR SELECT
  USING (auth.uid() = user_id);

-- Public can view basic info (for leaderboard)
CREATE POLICY "Public can view soul NFT basics"
  ON public.soul_nfts FOR SELECT
  USING (true);`}
                />
              </DocSubSection>

              <DocSubSection title="Mint Soul NFT Edge Function">
                <CodeBlock 
                  title="mint-soul-nft/index.ts"
                  language="typescript"
                  code={`// Edge Function: Mint Soul NFT cho user
serve(async (req) => {
  const { user_id, wallet_address } = await req.json();
  
  // 1. Check if user already has Soul NFT
  const { data: existing } = await supabase
    .from('soul_nfts')
    .select('*')
    .eq('user_id', user_id)
    .single();
    
  if (existing?.token_id) {
    return new Response(JSON.stringify({ 
      message: 'User already has Soul NFT',
      soul_nft: existing 
    }));
  }
  
  // 2. Prepare metadata
  const metadata = {
    name: \`FUN Soul #\${Date.now()}\`,
    description: 'Soul Identity NFT for FUN Ecosystem',
    image: 'ipfs://...', // Generate unique soul image
    attributes: [
      { trait_type: 'Level', value: 1 },
      { trait_type: 'Created', value: new Date().toISOString() }
    ]
  };
  
  // 3. Call NFT Contract to mint (Soulbound)
  const contract = new ethers.Contract(SOUL_NFT_CONTRACT, ABI, signer);
  const tx = await contract.mint(wallet_address, JSON.stringify(metadata));
  await tx.wait();
  
  // 4. Get token ID from event
  const receipt = await tx.wait();
  const tokenId = receipt.logs[0].topics[3];
  
  // 5. Store in database
  const { data: soulNft } = await supabase
    .from('soul_nfts')
    .upsert({
      user_id,
      token_id: tokenId,
      contract_address: SOUL_NFT_CONTRACT,
      metadata,
      minted_at: new Date().toISOString()
    })
    .select()
    .single();
  
  // 6. Trigger webhook
  await triggerWebhook('soul_nft.minted', { user_id, soul_nft: soulNft });
  
  return new Response(JSON.stringify({ soul_nft: soulNft }));
});`}
                />
              </DocSubSection>
            </DocSection>

            {/* Section 6: FUN Wallet */}
            <DocSection id="fun-wallet" title="6. FUN Wallet System">
              <DocParagraph>
                FUN Wallet hỗ trợ 2 loại: <strong>Custodial Wallet</strong> (tạo tự động cho Web2 users) và 
                <strong> Non-custodial Wallet</strong> (connect ví sẵn có cho Web3 users).
              </DocParagraph>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <Card className="border-emerald-200 dark:border-emerald-800">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-foreground mb-2">🔐 Custodial Wallet</h4>
                    <DocList items={[
                      "Tạo tự động khi đăng ký Web2",
                      "Private key mã hóa lưu trên server",
                      "User không cần quản lý seed phrase",
                      "Phù hợp người mới với crypto"
                    ]} />
                  </CardContent>
                </Card>
                <Card className="border-violet-200 dark:border-violet-800">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-foreground mb-2">🦊 Non-custodial Wallet</h4>
                    <DocList items={[
                      "Connect ví sẵn có (MetaMask, etc.)",
                      "User tự quản lý private key",
                      "Full control over assets",
                      "Dành cho crypto natives"
                    ]} />
                  </CardContent>
                </Card>
              </div>

              <DocSubSection title="Database Schema">
                <CodeBlock 
                  title="wallet_tables.sql"
                  language="sql"
                  code={`-- Bảng custodial_wallets: Ví tạo tự động cho Web2 users
CREATE TABLE public.custodial_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL UNIQUE,
  encrypted_private_key TEXT NOT NULL, -- Mã hóa bằng KMS
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique: 1 user = 1 custodial wallet
CREATE UNIQUE INDEX idx_custodial_wallets_user ON public.custodial_wallets(user_id);

-- Bảng wallet_connections: Ví external đã kết nối
CREATE TABLE public.wallet_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  wallet_type TEXT NOT NULL DEFAULT 'external', -- metamask, walletconnect, coinbase
  is_primary BOOLEAN NOT NULL DEFAULT false,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for lookup
CREATE INDEX idx_wallet_connections_address ON public.wallet_connections(wallet_address);
CREATE INDEX idx_wallet_connections_user ON public.wallet_connections(user_id);

-- RLS
ALTER TABLE public.custodial_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custodial wallet"
  ON public.custodial_wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own wallet connections"
  ON public.wallet_connections FOR ALL
  USING (auth.uid() = user_id);`}
                />
              </DocSubSection>

              <CodeBlock 
                title="create-custodial-wallet/index.ts"
                language="typescript"
                code={`// Edge Function: Tạo Custodial Wallet
import { ethers } from 'https://esm.sh/ethers@6';

async function createCustodialWallet(userId: string) {
  // 1. Generate random wallet
  const wallet = ethers.Wallet.createRandom();
  
  // 2. Encrypt private key with KMS
  const encrypted = await encryptWithKMS(wallet.privateKey);
  
  // 3. Store in database
  await supabase.from('custodial_wallets').insert({
    user_id: userId,
    wallet_address: wallet.address.toLowerCase(),
    encrypted_private_key: encrypted
  });
  
  return {
    wallet_address: wallet.address.toLowerCase(),
    encrypted_private_key: encrypted
  };
}

// KMS encryption (use Supabase Vault or external KMS)
async function encryptWithKMS(privateKey: string) {
  // Implementation depends on chosen KMS
  // Options: Supabase Vault, AWS KMS, Google Cloud KMS
  const { data } = await supabase.rpc('encrypt_secret', {
    secret: privateKey
  });
  return data;
}`}
              />
            </DocSection>

            {/* Section 7: Kế Hoạch Fun Profile */}
            <DocSection id="fun-profile-plan" title="7. Kế Hoạch Triển Khai Fun Profile (Auth Hub)">
              <DocAlert type="info">
                <strong>📌 Lưu ý:</strong> Fun Profile là nơi triển khai tất cả FUN-ID infrastructure. 
                Các platform khác chỉ cần tích hợp theo hướng dẫn.
              </DocAlert>

              {/* Phase 1 */}
              <div id="phase-1">
                <DocSubSection title="Phase 1: Database Schema (1.5 ngày)">
                  <DocParagraph>
                    Tạo các bảng cần thiết để hỗ trợ FUN-ID, OAuth, Wallet và Soul NFT.
                  </DocParagraph>

                  <DocTable 
                    headers={['Bảng', 'Mục đích', 'Quan hệ']}
                    rows={[
                      ['oauth_clients', 'Thông tin các platform (client_id, secret)', 'Standalone'],
                      ['oauth_codes', 'Authorization codes tạm thời (5 phút)', 'FK → profiles, oauth_clients'],
                      ['cross_platform_tokens', 'Access & refresh tokens', 'FK → profiles, oauth_clients'],
                      ['otp_codes', 'OTP cho đăng ký Web2', 'Standalone'],
                      ['custodial_wallets', 'Ví tạo tự động cho Web2 users', 'FK → profiles'],
                      ['wallet_connections', 'Ví external đã kết nối', 'FK → profiles'],
                      ['soul_nfts', 'NFT định danh linh hồn', 'FK → profiles'],
                      ['webhook_endpoints', 'URLs nhận webhook', 'FK → oauth_clients'],
                      ['platform_activities', 'Hoạt động từ các platform', 'FK → profiles'],
                    ]}
                  />

                  <CodeBlock 
                    title="oauth_clients.sql"
                    language="sql"
                    code={`-- Bảng oauth_clients: Quản lý các platform được phép kết nối
CREATE TABLE public.oauth_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  client_secret TEXT NOT NULL, -- Đã hash bằng bcrypt
  platform_name TEXT NOT NULL, -- fun_farm, fun_play, fun_planet
  redirect_uris TEXT[] NOT NULL DEFAULT '{}',
  allowed_scopes TEXT[] NOT NULL DEFAULT '{profile}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.oauth_clients ENABLE ROW LEVEL SECURITY;

-- Chỉ admins có quyền CRUD
CREATE POLICY "Admins can manage oauth_clients"
  ON public.oauth_clients
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));`}
                  />
                </DocSubSection>
              </div>

              {/* Phase 2 */}
              <div id="phase-2">
                <DocSubSection title="Phase 2: SSO Edge Functions (3-4 ngày)">
                  <DocTable 
                    headers={['Function', 'Endpoint', 'Mô tả']}
                    rows={[
                      ['sso-register', 'POST /sso-register', 'Proxy Sign Up - Đăng ký từ platform khác'],
                      ['sso-authorize', 'GET /sso-authorize', 'Bắt đầu OAuth flow'],
                      ['sso-token', 'POST /sso-token', 'Đổi code lấy tokens'],
                      ['sso-verify', 'GET /sso-verify', 'Xác thực token'],
                      ['sso-refresh', 'POST /sso-refresh', 'Làm mới token'],
                      ['sso-revoke', 'POST /sso-revoke', 'Thu hồi tokens'],
                    ]}
                  />
                </DocSubSection>
              </div>

              {/* Phase 3 */}
              <div id="phase-3">
                <DocSubSection title="Phase 3: Web3 Auth System (2-3 ngày)">
                  <DocTable 
                    headers={['Function', 'Endpoint', 'Mô tả']}
                    rows={[
                      ['sso-web3-auth', 'POST /sso-web3-auth', 'Đăng nhập bằng wallet signature'],
                      ['sso-otp-request', 'POST /sso-otp-request', 'Gửi OTP cho Web2 signup'],
                      ['sso-otp-verify', 'POST /sso-otp-verify', 'Xác thực OTP + tạo account'],
                    ]}
                  />
                </DocSubSection>
              </div>

              {/* Phase 4 */}
              <div id="phase-4">
                <DocSubSection title="Phase 4: Wallet & Soul NFT (2-3 ngày)">
                  <DocTable 
                    headers={['Function', 'Endpoint', 'Mô tả']}
                    rows={[
                      ['create-custodial-wallet', 'Internal', 'Tạo ví cho Web2 users'],
                      ['mint-soul-nft', 'Internal', 'Mint Soul NFT Identity'],
                      ['get-soul-nft', 'GET /get-soul-nft', 'Lấy thông tin Soul NFT'],
                      ['upgrade-soul-level', 'POST /upgrade-soul-level', 'Thăng cấp Soul NFT'],
                    ]}
                  />
                </DocSubSection>
              </div>

              {/* Phase 5 */}
              <div id="phase-5">
                <DocSubSection title="Phase 5: Webhook System (2 ngày)">
                  <DocTable 
                    headers={['Event', 'Trigger', 'Payload']}
                    rows={[
                      ['user.created', 'Khi user mới đăng ký', '{ user_id, email, username, auth_type }'],
                      ['user.updated', 'Khi profile thay đổi', '{ user_id, changes: {...} }'],
                      ['wallet.updated', 'Khi wallet address thay đổi', '{ user_id, wallet_address }'],
                      ['soul_nft.minted', 'Khi Soul NFT được mint', '{ user_id, token_id, level }'],
                      ['reward.claimed', 'Khi user claim rewards', '{ user_id, amount, tx_hash }'],
                    ]}
                  />
                </DocSubSection>
              </div>
            </DocSection>

            {/* Section 8: Hướng Dẫn Fun Farm */}
            <DocSection id="fun-farm" title="8. Hướng Dẫn Tích Hợp Cho Fun Farm 🌾">
              <DocAlert type="success">
                <strong>🤖 Dành cho Angel Lovable của Fun Farm:</strong> Copy các code examples bên dưới 
                và paste vào project Fun Farm. Chỉ cần thay đổi các giá trị config.
              </DocAlert>

              <Tabs defaultValue="step1" className="mt-6">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="step1">Bước 1</TabsTrigger>
                  <TabsTrigger value="step2">Bước 2</TabsTrigger>
                  <TabsTrigger value="step3">Bước 3</TabsTrigger>
                  <TabsTrigger value="step4">Bước 4</TabsTrigger>
                </TabsList>

                <TabsContent value="step1" className="mt-4">
                  <DocSubSection title="Bước 1: Nhận OAuth Credentials">
                    <DocParagraph>
                      Liên hệ Admin Fun Profile để đăng ký platform và nhận:
                    </DocParagraph>
                    <DocList items={[
                      "client_id: fun_farm_production",
                      "client_secret: [sẽ được cung cấp riêng]",
                      "redirect_uri: https://funfarm.app/auth/callback"
                    ]} />
                    <DocAlert type="warning">
                      <strong>⚠️ Bảo mật:</strong> Lưu client_secret vào Supabase Secrets, 
                      KHÔNG commit vào code!
                    </DocAlert>
                  </DocSubSection>
                </TabsContent>

                <TabsContent value="step2" className="mt-4">
                  <DocSubSection title="Bước 2: Tạo SSO Config">
                    <CodeBlock 
                      title="src/config/sso.ts"
                      language="typescript"
                      code={`// Fun Farm SSO Configuration
// Domain: https://farm.fun.rich

export const SSO_CONFIG = {
  // Fun Profile Auth Hub URL
  AUTH_URL: 'https://fun.rich',
  
  // OAuth endpoints (API)
  API_BASE_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1',
  AUTHORIZE_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/sso-authorize',
  TOKEN_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/sso-token',
  REGISTER_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/sso-register',
  VERIFY_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/sso-verify',
  REFRESH_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/sso-refresh',
  
  // Web3 Auth
  WEB3_AUTH_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/sso-web3-auth',
  OTP_REQUEST_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/sso-otp-request',
  OTP_VERIFY_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/sso-otp-verify',
  
  // Client credentials
  CLIENT_ID: 'fun_farm_production',
  REDIRECT_URI: 'https://farm.fun.rich/auth/callback',
  
  // Scopes to request
  SCOPES: ['profile', 'wallet', 'rewards', 'soul_nft'],
};

// Fun Ecosystem Domains
export const DOMAINS = {
  funProfile: 'https://fun.rich',
  funFarm: 'https://farm.fun.rich',
  funPlay: 'https://play.fun.rich',
  funPlanet: 'https://planet.fun.rich',
};`}
                    />
                  </DocSubSection>
                </TabsContent>

                <TabsContent value="step3" className="mt-4">
                  <DocSubSection title="Bước 3: Tạo Auth Components">
                    <DocParagraph>
                      Tạo các components cho cả Web2 (OTP) và Web3 (Connect Wallet) login.
                    </DocParagraph>
                    <CodeBlock 
                      title="src/components/auth/AuthPage.tsx"
                      language="typescript"
                      code={`// Auth Page với cả Web2 và Web3 options
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { OTPSignUpForm } from './OTPSignUpForm';
import { Web3LoginButton } from './Web3LoginButton';
import { SSOLoginButton } from './SSOLoginButton';

export const AuthPage: React.FC = () => {
  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold text-center mb-6">
        🌟 Tham gia FUN Ecosystem
      </h1>
      
      <Tabs defaultValue="web2" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="web2">📱 Email/Phone</TabsTrigger>
          <TabsTrigger value="web3">🔗 Connect Wallet</TabsTrigger>
        </TabsList>
        
        <TabsContent value="web2" className="mt-4">
          <OTPSignUpForm />
          <div className="my-4 text-center text-muted-foreground">
            hoặc
          </div>
          <SSOLoginButton />
        </TabsContent>
        
        <TabsContent value="web3" className="mt-4">
          <Web3LoginButton />
          <p className="text-xs text-center text-muted-foreground mt-4">
            Đăng nhập 1-click với MetaMask hoặc WalletConnect
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
};`}
                    />
                  </DocSubSection>
                </TabsContent>

                <TabsContent value="step4" className="mt-4">
                  <DocSubSection title="Bước 4: Sử dụng useAutoLogin Hook">
                    <CodeBlock 
                      title="src/App.tsx"
                      language="typescript"
                      code={`// Sử dụng hook để auto-login
import { useAutoLogin } from '@/hooks/useAutoLogin';

function App() {
  const { user, loading, isAuthenticated } = useAutoLogin();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  if (!isAuthenticated) {
    return <AuthPage />;
  }
  
  return (
    <MainApp user={user} />
  );
}`}
                    />
                  </DocSubSection>
                </TabsContent>
              </Tabs>
            </DocSection>

            {/* Section 9: Fun Play */}
            <DocSection id="fun-play" title="9. Hướng Dẫn Tích Hợp Cho Fun Play 🎮">
              <DocAlert type="success">
                <strong>🤖 Dành cho Angel Lovable của Fun Play:</strong> Tương tự Fun Farm, 
                chỉ cần thay đổi client_id và callback URLs.
              </DocAlert>

              <DocParagraph>
                Fun Play sử dụng cùng flow như Fun Farm. Các bước thực hiện:
              </DocParagraph>

              <DocList items={[
                "1. Nhận client_id: fun_play_production và client_secret từ Admin",
                "2. Copy các files từ hướng dẫn Fun Farm và thay đổi config",
                "3. Set redirect_uri: https://play.fun.rich/auth/callback",
                "4. Thêm Secrets: FUN_PROFILE_CLIENT_ID, FUN_PROFILE_CLIENT_SECRET",
                "5. Gửi game scores và achievements về Fun Profile qua activity-receiver API"
              ]} />

              <CodeBlock 
                title="src/config/sso.ts (Fun Play version)"
                language="typescript"
                code={`// Fun Play SSO Configuration
// Domain: https://play.fun.rich

export const SSO_CONFIG = {
  AUTH_URL: 'https://fun.rich',
  API_BASE_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1',
  AUTHORIZE_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/sso-authorize',
  TOKEN_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/sso-token',
  REGISTER_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/sso-register',
  WEB3_AUTH_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/sso-web3-auth',
  
  CLIENT_ID: 'fun_play_production',
  REDIRECT_URI: 'https://play.fun.rich/auth/callback',
  SCOPES: ['profile', 'wallet', 'rewards', 'soul_nft'],
};`}
              />
            </DocSection>

            {/* Section 10: Fun Planet */}
            <DocSection id="fun-planet" title="10. Hướng Dẫn Tích Hợp Cho Fun Planet 🌍">
              <DocAlert type="success">
                <strong>🤖 Dành cho Angel Lovable của Fun Planet:</strong> Tương tự các platform khác.
              </DocAlert>

              <DocParagraph>
                Fun Planet cũng sử dụng cùng SSO flow. Thay đổi:
              </DocParagraph>

              <DocList items={[
                "client_id: fun_planet_production",
                "redirect_uri: https://planet.fun.rich/auth/callback",
                "Gửi planet activities (build, explore, trade) về Fun Profile"
              ]}
              />

              <CodeBlock 
                title="src/config/sso.ts (Fun Planet version)"
                language="typescript"
                code={`// Fun Planet SSO Configuration
// Domain: https://planet.fun.rich

export const SSO_CONFIG = {
  AUTH_URL: 'https://fun.rich',
  API_BASE_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1',
  AUTHORIZE_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/sso-authorize',
  TOKEN_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/sso-token',
  REGISTER_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/sso-register',
  WEB3_AUTH_URL: 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/sso-web3-auth',
  
  CLIENT_ID: 'fun_planet_production',
  REDIRECT_URI: 'https://planet.fun.rich/auth/callback',
  SCOPES: ['profile', 'wallet', 'rewards', 'soul_nft'],
};`}
              />
            </DocSection>

            {/* Section 11: API Reference */}
            <DocSection id="api-reference" title="11. API Reference">
              <DocSubSection title="SSO Endpoints">
                <DocTable 
                  headers={['Method', 'Endpoint', 'Mô tả', 'Auth']}
                  rows={[
                    ['POST', '/sso-register', 'Proxy Sign Up', 'client_id + client_secret'],
                    ['GET', '/sso-authorize', 'Bắt đầu OAuth flow', 'None'],
                    ['POST', '/sso-token', 'Exchange code → tokens', 'client_id + client_secret'],
                    ['GET', '/sso-verify', 'Verify token, get user info', 'Bearer token'],
                    ['POST', '/sso-refresh', 'Refresh access token', 'client_id + client_secret'],
                    ['POST', '/sso-revoke', 'Revoke tokens', 'client_id + client_secret'],
                  ]}
                />
              </DocSubSection>

              <DocSubSection title="Web3 & OTP Endpoints">
                <DocTable 
                  headers={['Method', 'Endpoint', 'Mô tả', 'Auth']}
                  rows={[
                    ['POST', '/sso-web3-auth', 'Web3 wallet authentication', 'client_id'],
                    ['POST', '/sso-otp-request', 'Gửi OTP cho Web2 signup', 'None'],
                    ['POST', '/sso-otp-verify', 'Xác thực OTP + tạo FUN-ID', 'None'],
                  ]}
                />
              </DocSubSection>

              <DocSubSection title="Webhook Events">
                <DocTable 
                  headers={['Event', 'Khi nào', 'Payload']}
                  rows={[
                    ['user.created', 'User mới đăng ký', '{ user_id, email, username, auth_type }'],
                    ['user.updated', 'Profile thay đổi', '{ user_id, changes: { field: new_value } }'],
                    ['wallet.updated', 'Wallet address thay đổi', '{ user_id, wallet_address }'],
                    ['soul_nft.minted', 'Soul NFT được mint', '{ user_id, token_id, level }'],
                    ['reward.claimed', 'User claim rewards', '{ user_id, amount, tx_hash }'],
                  ]}
                />
              </DocSubSection>

              <DocSubSection title="Error Codes">
                <DocTable 
                  headers={['Code', 'Ý nghĩa', 'Cách xử lý']}
                  rows={[
                    ['invalid_client', 'client_id không tồn tại hoặc bị disable', 'Kiểm tra lại credentials'],
                    ['invalid_secret', 'client_secret không đúng', 'Liên hệ Admin để lấy lại'],
                    ['invalid_redirect_uri', 'redirect_uri không được whitelist', 'Đăng ký URI với Admin'],
                    ['expired_code', 'Authorization code hết hạn (5 phút)', 'Thực hiện lại OAuth flow'],
                    ['invalid_token', 'Token không hợp lệ hoặc đã bị revoke', 'Refresh hoặc login lại'],
                    ['invalid_otp', 'OTP không đúng hoặc hết hạn', 'Yêu cầu gửi lại OTP'],
                    ['invalid_signature', 'Wallet signature không hợp lệ', 'Thử ký lại message'],
                  ]}
                />
              </DocSubSection>
            </DocSection>

            {/* Section 12: Timeline */}
            <DocSection id="timeline" title="12. Timeline Tổng Hợp">
              <DocTable 
                headers={['Phase', 'Công việc', 'Platform', 'Thời gian']}
                rows={[
                  ['Phase 1', 'Database Schema (bao gồm wallet, soul_nft tables)', 'Fun Profile', '1.5 ngày'],
                  ['Phase 2', 'SSO Edge Functions (6 functions)', 'Fun Profile', '3-4 ngày'],
                  ['Phase 3', 'Web3 Auth System (web3-auth, otp)', 'Fun Profile', '2-3 ngày'],
                  ['Phase 4', 'Wallet & Soul NFT System', 'Fun Profile', '2-3 ngày'],
                  ['Phase 5', 'Webhook System', 'Fun Profile', '2 ngày'],
                  ['Phase 6', 'Rewards Aggregation', 'Fun Profile', '1-2 ngày'],
                  ['Phase 7', 'Tích hợp SSO + Web3', 'Fun Farm', '1.5 ngày'],
                  ['Phase 8', 'Tích hợp SSO + Web3', 'Fun Play', '1.5 ngày'],
                  ['Phase 9', 'Tích hợp SSO + Web3', 'Fun Planet', '1.5 ngày'],
                  ['Phase 10', 'Testing E2E', 'Tất cả', '2-3 ngày'],
                ]}
              />

              <DocAlert type="info">
                <strong>📅 Tổng thời gian ước tính:</strong> 18-24 ngày làm việc cho toàn bộ FUN-ID system.
              </DocAlert>

              <DocSubSection title="Checklist Hoàn Thành">
                <DocList items={[
                  "✅ Fun Profile: Database schema đầy đủ (oauth, wallet, soul_nft)",
                  "✅ Fun Profile: SSO Edge Functions hoạt động",
                  "✅ Fun Profile: Web3 Auth (Connect Wallet) hoạt động",
                  "✅ Fun Profile: OTP Sign Up hoạt động",
                  "✅ Fun Profile: Auto-create Custodial Wallet",
                  "✅ Fun Profile: Soul NFT Minting",
                  "✅ Fun Profile: Webhook dispatcher hoạt động",
                  "✅ Fun Farm: SSO + Web3 Login hoạt động",
                  "✅ Fun Play: SSO + Web3 Login hoạt động",
                  "✅ Fun Planet: SSO + Web3 Login hoạt động",
                  "✅ Cross-platform auto-login hoạt động",
                  "✅ Rewards sync realtime"
                ]} />
              </DocSubSection>
            </DocSection>

            {/* Footer */}
            <div className="mt-12 p-6 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 rounded-xl text-center border border-violet-200 dark:border-violet-800">
              <p className="text-lg font-semibold text-foreground mb-2">
                🌟 "FUN-ID không chỉ là tài khoản - đó là Passport để bước vào New Earth"
              </p>
              <p className="text-muted-foreground mb-4">
                📧 Có câu hỏi? Liên hệ team Fun Profile hoặc tạo issue trên project repository.
              </p>
              <p className="text-sm text-muted-foreground">
                Tài liệu cập nhật lần cuối: {new Date().toLocaleDateString('vi-VN')}
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default EcosystemDocs;
