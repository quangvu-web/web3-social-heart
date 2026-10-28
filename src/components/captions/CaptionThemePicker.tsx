import { Check, ChevronDown, Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CAPTION_THEMES, type CaptionTheme } from "./captionThemes";

export function CaptionThemePicker({ theme, onChange }: { theme: CaptionTheme; onChange: (theme: CaptionTheme) => void }) {
  const label = CAPTION_THEMES.find(option => option.value === theme)?.label;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-44 sm:w-64 max-w-full items-center gap-2 rounded-lg border border-caption-control-border bg-caption-control/60 px-3 py-2 text-sm font-medium text-caption-control-foreground hover:bg-caption-control-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-caption-speaker"
          aria-label={`Chọn giao diện phụ đề: ${label}`}
          title={`Giao diện: ${label}`}
        >
          <Palette className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">Giao diện: {label}</span>
          <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        data-caption-theme={theme}
        aria-label="Giao diện phụ đề"
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)] max-h-[70dvh] overflow-y-auto border-caption-control-border bg-caption-background p-3 text-caption-foreground"
      >
        <p className="mb-3 text-sm font-semibold">Chọn giao diện</p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Các giao diện phụ đề">
          {CAPTION_THEMES.map(option => (
            <button
              key={option.value}
              type="button"
              data-caption-theme={option.value}
              aria-pressed={theme === option.value}
              aria-label={option.label}
              onClick={() => onChange(option.value)}
              className={`relative min-w-0 rounded-lg border-2 bg-caption-background p-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-caption-speaker ${theme === option.value ? "border-caption-speaker" : "border-caption-control-border"}`}
            >
              <span className="mb-2 flex items-center justify-between gap-1 text-xs font-semibold text-caption-speaker">
                {option.label}
                {theme === option.value && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
              </span>
              <span className="block text-sm font-medium text-caption-foreground">Xin chào</span>
              <span className="block text-xs text-caption-muted">Hello</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-caption-muted">Lưu trên thiết bị này</p>
      </PopoverContent>
    </Popover>
  );
}
