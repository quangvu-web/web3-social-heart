/** Map function_name → feature bucket cho báo cáo Cloud Usage. */
const EXACT: Record<string, string> = {
  "telegram-community-webhook": "Angel AI · Telegram",
  "angel-chat": "Angel AI · DM",
  "angel-inline": "Angel AI · Inline",
  "angel-files-ingest": "Angel Knowledge Ingest",
  "meditation-broadcast": "Meditation",
  "telegram-message-reaper": "Telegram Cleanup",
  "reconcile-pending-replays": "Live Recording",
  "retry-archive-replays": "Live Recording",
  "process-live-recordings": "Live Recording",
  "live-watchdog-cleanup": "Live Recording",
  "live-part-upload": "Live Recording",
  "rtmp-producer-sweeper": "Live/RTMP",
  "agora-token": "Live/Call",
};
const PREFIX: Array<[string, string]> = [
  ["telegram-", "Telegram"],
  ["wallet-", "Wallet"],
  ["reward-", "Reward System"],
  ["live-", "Live Recording"],
  ["angel-", "Angel AI"],
];

export function mapFeature(functionName: string, override?: string | null): string {
  if (override) return override;
  if (EXACT[functionName]) return EXACT[functionName];
  for (const [p, tag] of PREFIX) if (functionName.startsWith(p)) return tag;
  return "Other";
}
