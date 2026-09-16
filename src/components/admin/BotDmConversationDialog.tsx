import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { User, Bot, Image as ImageIcon, FileText, Mic, Video, Sticker } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  telegramUserId: number | null;
  displayName: string;
}

interface DmEvent {
  id: number;
  created_at: string;
  direction: "in" | "out" | null;
  kind: string;
  command: string | null;
  text_preview: string | null;
  media_kind: string | null;
  media_file_id: string | null;
  media_mime: string | null;
  media_caption: string | null;
  bot_reply_to_message_id: number | null;
}

function fmtKL(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    hour12: false,
  });
}

function mediaIcon(kind: string | null) {
  switch (kind) {
    case "photo": return <ImageIcon className="h-3 w-3" />;
    case "document": return <FileText className="h-3 w-3" />;
    case "voice":
    case "audio": return <Mic className="h-3 w-3" />;
    case "video":
    case "video_note": return <Video className="h-3 w-3" />;
    case "sticker": return <Sticker className="h-3 w-3" />;
    default: return null;
  }
}

export default function BotDmConversationDialog({
  open,
  onOpenChange,
  telegramUserId,
  displayName,
}: Props) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["bot-dm-events", telegramUserId],
    enabled: open && !!telegramUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_bot_dm_events" as any)
        .select("*")
        .eq("telegram_user_id", telegramUserId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as DmEvent[];
    },
    staleTime: 10_000,
  });

  const { data: memoryState } = useQuery({
    queryKey: ["bot-dm-memory-state", telegramUserId],
    enabled: open && !!telegramUserId,
    queryFn: async () => {
      const uid = String(telegramUserId);
      const scopeKey = `dm:${uid}:${uid}`;
      const [anchor, memory, summary] = await Promise.all([
        supabase
          .from("angel_last_question" as any)
          .select("question, anchor_context, updated_at")
          .eq("scope_key", scopeKey)
          .maybeSingle(),
        supabase
          .from("angel_user_memory" as any)
          .select("facts, updated_at")
          .eq("channel", "telegram")
          .eq("user_key", uid)
          .maybeSingle(),
        supabase
          .from("angel_conversation_summary" as any)
          .select("summary, turns_covered, updated_at")
          .eq("channel", "telegram_dm")
          .eq("scope_key", uid)
          .maybeSingle(),
      ]);
      return {
        anchor: (anchor.data ?? null) as any,
        memory: (memory.data ?? null) as any,
        summary: (summary.data ?? null) as any,
      };
    },
    staleTime: 15_000,
  });

  // Reverse for chronological display (oldest top)
  const ordered = [...events].reverse();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>💬 Hội thoại DM — {displayName}</DialogTitle>
        </DialogHeader>
        {(memoryState?.anchor || memoryState?.memory || memoryState?.summary) && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-2">
            <div className="font-semibold text-foreground">🧠 Trí nhớ hiện tại</div>
            {memoryState?.anchor?.question && (
              <div>
                <div className="opacity-70">Anchor câu hỏi cuối · {fmtKL(memoryState.anchor.updated_at)}</div>
                {memoryState.anchor.anchor_context && (
                  <div className="italic opacity-80 whitespace-pre-wrap break-words">
                    ↳ ngữ cảnh: {memoryState.anchor.anchor_context}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">Q: {memoryState.anchor.question}</div>
              </div>
            )}
            {memoryState?.memory?.facts && (
              <div>
                <div className="opacity-70">Long-term memory · {fmtKL(memoryState.memory.updated_at)}</div>
                <div className="whitespace-pre-wrap break-words">
                  {typeof memoryState.memory.facts === "string"
                    ? memoryState.memory.facts
                    : JSON.stringify(memoryState.memory.facts, null, 2)}
                </div>
              </div>
            )}
            {memoryState?.summary?.summary && (
              <div>
                <div className="opacity-70">
                  Rolling summary · {memoryState.summary.turns_covered ?? 0} turn · {fmtKL(memoryState.summary.updated_at)}
                </div>
                <div className="whitespace-pre-wrap break-words">{memoryState.summary.summary}</div>
              </div>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {isLoading && (
            <div className="text-center text-muted-foreground py-6">Loading…</div>
          )}
          {!isLoading && ordered.length === 0 && (
            <div className="text-center text-muted-foreground py-6">
              Chưa có sự kiện DM nào.
            </div>
          )}
          {ordered.map((ev) => {
            const isBot = ev.direction === "out";
            return (
              <div
                key={ev.id}
                className={`flex gap-2 ${isBot ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 text-sm ${
                    isBot
                      ? "bg-muted text-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
                    {isBot ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                    <span>{isBot ? "Bot" : "User"}</span>
                    <span>·</span>
                    <span>{fmtKL(ev.created_at)}</span>
                    {ev.command && (
                      <Badge variant="outline" className="ml-1 text-[10px] py-0">
                        {ev.command}
                      </Badge>
                    )}
                    {ev.media_kind && (
                      <Badge variant="outline" className="ml-1 text-[10px] py-0 gap-1">
                        {mediaIcon(ev.media_kind)} {ev.media_kind}
                      </Badge>
                    )}
                  </div>
                  {ev.text_preview && (
                    <div className="whitespace-pre-wrap break-words">
                      {ev.text_preview}
                    </div>
                  )}
                  {ev.media_caption && (
                    <div className="mt-1 italic opacity-80 whitespace-pre-wrap break-words">
                      caption: {ev.media_caption}
                    </div>
                  )}
                  {ev.media_file_id && (
                    <div className="mt-1 text-[10px] opacity-60 font-mono break-all">
                      file_id: {ev.media_file_id}
                      {ev.media_mime ? ` (${ev.media_mime})` : ""}
                    </div>
                  )}
                  {!ev.text_preview && !ev.media_kind && (
                    <div className="italic opacity-60">[{ev.kind}]</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
