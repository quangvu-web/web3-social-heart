export type AdminTab =
  | "overview" | "users" | "security" | "members" | "financial" | "rewards" | "review"
  | "abuse" | "delete" | "blockchain" | "migration" | "live-recording" | "merge" | "antisybil"
  | "telegram" | "dm-bot" | "mutes" | "father" | "ai-triggers" | "allowlists" | "restream"
  | "meditation" | "angel-persona" | "ai-conversations" | "angel-channels" | "angel-memory"
  | "feedback" | "cloud-usage" | "prompt-versions" | "feature-flags" | "ai-ops";

export interface AdminNavigationItem {
  value: AdminTab;
  label: string;
}

export interface AdminNavigationGroup {
  label: string;
  items: AdminNavigationItem[];
}

export const adminNavigationGroups: AdminNavigationGroup[] = [
  { label: "Tổng quan", items: [{ value: "overview", label: "Tổng quan" }] },
  {
    label: "Cộng đồng",
    items: [
      { value: "telegram", label: "Nhóm & webhook" },
      { value: "mutes", label: "Moderation & mutes" },
      { value: "allowlists", label: "Allowlist" },
      { value: "ai-triggers", label: "AI triggers" },
      { value: "father", label: "Kênh Cha VT" },
    ],
  },
  {
    label: "Hội thoại",
    items: [
      { value: "dm-bot", label: "DM bot" },
      { value: "ai-conversations", label: "Lịch sử hội thoại" },
      { value: "feedback", label: "Góp ý người dùng" },
    ],
  },
  {
    label: "Cài đặt",
    items: [
      { value: "angel-persona", label: "AI & persona" },
      { value: "security", label: "Bảo mật" },
    ],
  },
  {
    label: "Công cụ khác",
    items: [
      { value: "users", label: "Người dùng" },
      { value: "members", label: "Phân tích thành viên" },
      { value: "financial", label: "Tài chính" },
      { value: "rewards", label: "Duyệt thưởng" },
      { value: "review", label: "Rà soát người dùng" },
      { value: "abuse", label: "Lạm dụng ví" },
      { value: "delete", label: "Xóa nhanh" },
      { value: "blockchain", label: "Blockchain" },
      { value: "migration", label: "Di chuyển media" },
      { value: "live-recording", label: "Ghi hình trực tiếp" },
      { value: "merge", label: "Gộp tài khoản" },
      { value: "antisybil", label: "Anti-Sybil" },
      { value: "restream", label: "Restream" },
      { value: "meditation", label: "Lịch thiền" },
      { value: "angel-channels", label: "Angel Channels" },
      { value: "angel-memory", label: "Bộ nhớ Angel" },
      { value: "cloud-usage", label: "Cloud Usage" },
      { value: "prompt-versions", label: "Phiên bản prompt" },
      { value: "feature-flags", label: "Feature Flags" },
      { value: "ai-ops", label: "AI Ops" },
    ],
  },
];

const adminTabs = new Set(adminNavigationGroups.flatMap((group) => group.items.map((item) => item.value)));

export function resolveAdminTab(search: string | URLSearchParams): AdminTab {
  const params = typeof search === "string" ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search) : search;
  const value = params.get("tab");
  return value && adminTabs.has(value as AdminTab) ? value as AdminTab : "overview";
}

export function buildAdminTabSearch(search: string | URLSearchParams, tab: AdminTab): string {
  const params = typeof search === "string" ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search) : new URLSearchParams(search);
  params.set("tab", tab);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}
