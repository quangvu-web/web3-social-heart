export const CAPTION_THEMES = [
  { value: "dark", label: "Tối" },
  { value: "light", label: "Sáng" },
  { value: "warm", label: "Giấy ấm" },
  { value: "neutral", label: "Trung tính" },
  { value: "energy", label: "Năng lượng" },
  { value: "high-contrast", label: "Tương phản cao" },
] as const;

export type CaptionTheme = typeof CAPTION_THEMES[number]["value"];

export function readCaptionTheme(storage?: Pick<Storage, "getItem">): CaptionTheme {
  try {
    const value = (storage ?? window.localStorage).getItem("caption-theme");
    return CAPTION_THEMES.find(theme => theme.value === value)?.value ?? "dark";
  } catch {
    return "dark";
  }
}

export function saveCaptionTheme(theme: CaptionTheme, storage?: Pick<Storage, "setItem">): void {
  try {
    (storage ?? window.localStorage).setItem("caption-theme", theme);
  } catch {
    // Selection still works for this page when device storage is unavailable.
  }
}
