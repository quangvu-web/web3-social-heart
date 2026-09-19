import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Send,
  ShieldCheck,
  MessageCircle,
  KeyRound,
  Smartphone,
  Lock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Bot,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useState } from 'react';

const StepCard = ({
  number,
  title,
  description,
  icon: Icon,
  children,
  highlight = false,
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ElementType;
  children?: React.ReactNode;
  highlight?: boolean;
}) => (
  <div
    className={`relative rounded-xl border p-5 transition-all ${
      highlight
        ? 'border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/20'
        : 'border-border bg-card hover:border-primary/30'
    }`}
  >
    <div className="flex items-start gap-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          highlight
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
            : 'bg-primary/10 text-primary'
        }`}
      >
        {number}
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        {children && <div className="pt-2">{children}</div>}
      </div>
    </div>
  </div>
);

const TipBox = ({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'warning' | 'success' }) => {
  const styles = {
    info: 'bg-blue-50/50 border-blue-200 text-blue-800 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-300',
    warning: 'bg-amber-50/50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-300',
    success: 'bg-green-50/50 border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-800 dark:text-green-300',
  };

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles[type]}`}>
      {children}
    </div>
  );
};

const Telegram2FAGuide = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [showOtpDemo, setShowOtpDemo] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <FacebookNavbar />

      <main className="pt-14 pb-20 md:pb-6">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Send className="w-6 h-6 text-primary" />
                Hướng dẫn Telegram 2FA
              </h1>
              <p className="text-muted-foreground">
                Bảo vệ tài khoản bằng mã OTP qua Telegram
              </p>
            </div>
          </div>

          {/* What is Telegram 2FA */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Telegram 2FA là gì?
              </CardTitle>
              <CardDescription>
                Lớp bảo vệ thứ hai sau mật khẩu — mỗi lần đăng nhập bạn sẽ nhận mã OTP qua Telegram
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted/50 p-4 text-center space-y-2">
                  <Lock className="w-6 h-6 mx-auto text-primary" />
                  <p className="text-sm font-medium">Bảo mật cao</p>
                  <p className="text-xs text-muted-foreground">Mã OTP chỉ gửi đến Telegram riêng của bạn</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-center space-y-2">
                  <Smartphone className="w-6 h-6 mx-auto text-primary" />
                  <p className="text-sm font-medium">Không cần SMS</p>
                  <p className="text-xs text-muted-foreground">Không phụ thuộc số điện thoại hay nhà mạng</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-center space-y-2">
                  <KeyRound className="w-6 h-6 mx-auto text-primary" />
                  <p className="text-sm font-medium">Tùy chọn bật/tắt</p>
                  <p className="text-xs text-muted-foreground">Bạn kiểm soát khi nào cần xác minh</p>
                </div>
              </div>

              <TipBox type="info">
                <strong>Áp dụng cho:</strong> Đăng nhập Email OTP, Wallet Login và Email/Password thông thường.
                <br />
                <strong>Áp dụng:</strong> Google OAuth cũng yêu cầu mã Telegram khi tài khoản đã bật Telegram 2FA.
              </TipBox>
            </CardContent>
          </Card>

          {/* How to link Telegram */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Cách liên kết Telegram
            </h2>

            <StepCard
              number={1}
              title="Vào Cài đặt → Bảo mật"
              description="Trong FUN Profile, nhấn vào avatar góc trên bên phải, chọn Cài đặt tài khoản (Account Settings), kéo xuống mục Telegram 2FA."
              icon={Smartphone}
            />

            <StepCard
              number={2}
              title="Nhấn 'Kết nối Telegram'"
              description="Hệ thống sẽ tạo một liên kết đặc biệt chứa mã token duy nhất của bạn. Nhấn nút để mở Telegram."
              icon={Send}
              highlight
            >
              <TipBox type="warning">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Liên kết có hiệu lực trong <strong>15 phút</strong>. Nếu hết hạn, bạn cần tạo lại.
              </TipBox>
            </StepCard>

            <StepCard
              number={3}
              title="Gửi /start cho bot trong Telegram"
              description="Khi Telegram mở ra, bạn sẽ thấy nút Start. Nhấn Start — bot tự động nhận diện và liên kết tài khoản FUN Profile của bạn."
              icon={MessageCircle}
            >
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Ví dụ tin nhắn bot phản hồi:</p>
                <div className="bg-background rounded-md p-3 text-sm border">
                  <p className="text-green-600 font-medium">✅ Tài khoản đã được liên kết!</p>
                  <p className="text-muted-foreground mt-1">Bạn có thể bật xác minh 2FA trong Cài đặt.</p>
                </div>
              </div>
            </StepCard>

            <StepCard
              number={4}
              title="Bật Telegram 2FA"
              description="Quay lại FUN Profile, công tắc Telegram 2FA sẽ hiện ra. Gạt sang phải để bật. Từ giờ mỗi lần đăng nhập đều cần mã OTP từ Telegram."
              icon={CheckCircle2}
              highlight
            />
          </div>

          <Separator />

          {/* How to get OTP at login */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Cách lấy mã OTP khi đăng nhập
            </h2>

            <StepCard
              number={1}
              title="Nhập email hoặc kết nối ví"
              description="Đăng nhập như bình thường bằng Email OTP, Wallet Login hoặc Email/Password."
              icon={Smartphone}
            />

            <StepCard
              number={2}
              title="Chờ mã OTP từ Telegram"
              description="Sau khi xác minh bước 1, bot Telegram tự động gửi tin nhắn chứa mã 6 số. Không cần làm gì thêm — mã đến trong vài giây."
              icon={MessageCircle}
              highlight
            >
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Ví dụ tin nhắn từ bot:</p>
                <div className="bg-background rounded-md p-3 text-sm border space-y-1">
                  <p className="font-medium">🔐 Mã xác minh FUN Profile</p>
                  <div className="flex items-center gap-2">
                    <code className="bg-primary/10 text-primary px-2 py-1 rounded font-mono text-lg tracking-wider">
                      {showOtpDemo ? '847291' : '••••••'}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setShowOtpDemo(!showOtpDemo)}
                    >
                      {showOtpDemo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigator.clipboard?.writeText('847291')}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Hiệu lực: 5 phút • Không chia sẻ mã này</p>
                </div>
              </div>
            </StepCard>

            <StepCard
              number={3}
              title="Nhập mã OTP vào FUN Profile"
              description="Quay lại trang đăng nhập FUN Profile, nhập 6 chữ số vào ô 'Nhập mã Telegram' và nhấn Xác minh. Bạn sẽ được đăng nhập ngay."
              icon={CheckCircle2}
            />

            <TipBox type="warning">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              Mã OTP có hiệu lực trong <strong>5 phút</strong> và chỉ dùng được <strong>1 lần</strong>. Nếu hết hạn hoặc sai quá 3 lần, bạn cần đăng nhập lại từ đầu.
            </TipBox>
          </div>

          <Separator />

          {/* Troubleshooting */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Xử lý sự cố thường gặp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="font-medium text-sm">Không nhận được mã OTP?</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc list-inside">
                    <li>Kiểm tra xem bạn đã nhấn <strong>Start</strong> trong Telegram chưa.</li>
                    <li>Xem trong mục Tin nhắn đã lưu (Saved Messages) — bot có thể bị chặn thông báo.</li>
                    <li>Thử ngắt kết nối và liên kết lại Telegram trong Cài đặt.</li>
                  </ul>
                </div>

                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="font-medium text-sm">Mã OTP báo 'Không hợp lệ'?</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc list-inside">
                    <li>Đảm bảo bạn nhập đúng <strong>6 chữ số</strong>, không có khoảng trắng hay dấu.</li>
                    <li>Mã có thể đã hết hạn — quay lại trang đăng nhập và thử lại.</li>
                  </ul>
                </div>

                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="font-medium text-sm">Muốn tắt Telegram 2FA?</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc list-inside">
                    <li>Vào Cài đặt → Telegram 2FA → gạt công tắc sang trái.</li>
                    <li>Hoặc nhấn <strong>Ngắt kết nối</strong> để xóa hoàn toàn liên kết Telegram.</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security tips */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-500" />
                Lưu ý bảo mật
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <TipBox type="success">
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                <strong>Không chia sẻ mã OTP</strong> với bất kỳ ai — kể cả nhân viên hỗ trợ.
              </TipBox>
              <TipBox type="success">
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                <strong>Không chụp màn hình</strong> mã OTP gửi qua Telegram nếu điện thoại có ứng dụng đồng bộ cloud.
              </TipBox>
              <TipBox type="success">
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                <strong>Bật khóa ứng dụng Telegram</strong> (Face ID/PIN) để người khác không đọc được tin nhắn nếu mượn điện thoại.
              </TipBox>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button className="flex-1" onClick={() => navigate('/settings/account')}>
              <ChevronRight className="w-4 h-4 mr-2" />
              Đi đến Cài đặt Telegram 2FA
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Quay lại
            </Button>
          </div>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default Telegram2FAGuide;
