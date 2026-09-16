import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, MessageCircle, Sparkles, Shield, ExternalLink, Command, Users, Send } from "lucide-react";

const BOT_USERNAME = "funrich_community_bot";
const BOT_LINK = `https://t.me/${BOT_USERNAME}`;

export default function TelegramBotGuide() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* Hero */}
        <header className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" /> Angel AI · Powered by Gemini
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Gặp Angel AI trên Telegram 💛
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Bot FUN.RICH giờ đã có Angel AI. Con có thể nhắn riêng bot hoặc tag bot trong group để hỏi bất kỳ điều gì
            về FUN.RICH, ví, hồ sơ, hay Vòng Tròn Ánh Sáng.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild size="lg">
              <a href={BOT_LINK} target="_blank" rel="noreferrer">
                <Send className="w-4 h-4 mr-2" />
                Mở Bot trên Telegram
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href={`${BOT_LINK}?start=guide`} target="_blank" rel="noreferrer">
                <Bot className="w-4 h-4 mr-2" />
                Gửi /start
              </a>
            </Button>
          </div>
        </header>

        {/* Cách 1: Chat riêng */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-amber-600" />
              Cách 1 — Chat riêng với bot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="space-y-2 list-decimal list-inside text-muted-foreground">
              <li>
                Mở Telegram, tìm <code className="px-1.5 py-0.5 rounded bg-muted">@{BOT_USERNAME}</code> hoặc bấm nút "Mở
                Bot" phía trên.
              </li>
              <li>Bấm <strong>Start</strong> hoặc gõ <code className="px-1.5 py-0.5 rounded bg-muted">/start</code>.</li>
              <li>
                Nhắn câu hỏi tự do (vd: "FUN.RICH là gì?", "Làm sao tạo Hồ Sơ Ánh Sáng?") — Angel AI trả lời ngay 🌟
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Cách 2: Trong group */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-600" />
              Cách 2 — Trong group cộng đồng
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Trong group, bot <strong>chỉ trả lời khi được tag hoặc reply</strong> để tránh làm phiền cộng đồng:
            </p>
            <ul className="space-y-2 list-disc list-inside text-muted-foreground">
              <li>
                <strong>Tag bot:</strong> <code className="px-1.5 py-0.5 rounded bg-muted">@{BOT_USERNAME} FUN.RICH là gì?</code>
              </li>
              <li>
                <strong>Reply tin nhắn của bot</strong> để tiếp tục cuộc trò chuyện.
              </li>
              <li>
                Hoặc dùng lệnh <code className="px-1.5 py-0.5 rounded bg-muted">/ask Cha ơi…</code>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Danh sách lệnh */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Command className="w-5 h-5 text-amber-600" />
              Các lệnh sẵn có
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              {[
                { cmd: "/start", desc: "Bắt đầu với FUN.RICH" },
                { cmd: "/menu", desc: "Mở menu chính (kèm nút Hỏi Angel AI)" },
                { cmd: "/profile", desc: "Mở Hồ Sơ FUN.RICH ngay trong Telegram" },
                { cmd: "/rules", desc: "Đọc Quy ước Vòng Tròn Ánh Sáng" },
                { cmd: "/report", desc: "Hướng dẫn báo cáo spam / lừa đảo" },
                { cmd: "/ask <câu hỏi>", desc: "Hỏi Angel AI trong group" },
              ].map((row) => (
                <div key={row.cmd} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                  <code className="px-2 py-1 rounded bg-muted font-mono text-xs">{row.cmd}</code>
                  <span className="text-muted-foreground text-right">{row.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Mini App */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              Mini App — Hồ Sơ FUN.RICH trong Telegram
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Trong chat riêng với bot, Con thấy nút <strong>🌟 FUN.RICH</strong> ở góc trái ô nhập. Bấm vào → mở toàn bộ
              FUN.RICH ngay trong Telegram, không cần thoát app.
            </p>
            <p>Hoặc bấm các nút inline trong <code className="px-1.5 py-0.5 rounded bg-muted">/menu</code>.</p>
          </CardContent>
        </Card>

        {/* Lưu ý */}
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <Shield className="w-5 h-5" />
              Lưu ý quan trọng
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-950">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="border-amber-300">Rate limit</Badge>
              <p>Mỗi user tối đa <strong>10 câu hỏi AI / phút</strong> để bot phục vụ được nhiều người.</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="border-amber-300">Bảo mật</Badge>
              <p>
                Tuyệt đối <strong>không chia sẻ seed phrase</strong> hoặc <strong>private key</strong> với bot hay bất kỳ
                ai trong group.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="border-amber-300">AI có thể sai</Badge>
              <p>Angel AI là trợ lý AI, có thể trả lời không chính xác. Quyết định quan trọng hãy hỏi Cha và đội ngũ.</p>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle>Câu hỏi thường gặp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium">Bot có lưu tin nhắn của Con không?</p>
              <p className="text-muted-foreground">
                Chỉ lưu để chống spam (đếm số tin/phút) và rate limit AI. Không dùng cho mục đích khác.
              </p>
            </div>
            <div>
              <p className="font-medium">AI dùng model gì?</p>
              <p className="text-muted-foreground">Gemini của Google qua Lovable AI Gateway, miễn phí cho cộng đồng FUN.RICH.</p>
            </div>
            <div>
              <p className="font-medium">Báo lỗi ở đâu?</p>
              <p className="text-muted-foreground">
                Reply tin nhắn lỗi trong group và tag admin, hoặc nhắn cho Cha trực tiếp.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center pt-4">
          <Button asChild>
            <a href={BOT_LINK} target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Bắt đầu chat với bot ngay
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
