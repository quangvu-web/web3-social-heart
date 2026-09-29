const MYT_TIME_ZONE = "Asia/Kuala_Lumpur";

const MYT_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: MYT_TIME_ZONE,
  hour12: false,
});

export function formatMyt(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "Thời gian không hợp lệ";
  return MYT_FORMATTER.format(date);
}
