import { useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useStickers } from '../hooks/useStickers';
import type { Sticker, StickerPack } from '../types';

interface StickerPickerProps {
  onSelect: (sticker: Sticker) => void;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

export function StickerPicker({ onSelect, disabled, open, onOpenChange }: StickerPickerProps) {
  const { packs, stickersByPack, isLoading } = useStickers();

  const defaultPackId = useMemo(() => packs[0]?.id || 'default', [packs]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {!onOpenChange && (
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="flex-shrink-0 border border-gold/30 hover:border-gold/60 rounded-full px-3"
            title="Stickers"
          >
            Stickers
          </Button>
        </PopoverTrigger>
      )}
      {onOpenChange && <PopoverTrigger asChild><span /></PopoverTrigger>}
      <PopoverContent className="w-80 p-0" side="top" align="start">
        <div className="border-b px-3 py-2 text-sm font-medium">Stickers</div>
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : packs.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">ChÆ°a cĂ³ bá»™ sticker</div>
        ) : (
          <Tabs defaultValue={defaultPackId} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              {packs.map((p: StickerPack) => (
                <TabsTrigger key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {packs.map((p: StickerPack) => {
              const stickers = stickersByPack.get(p.id) || [];
              return (
                <TabsContent key={p.id} value={p.id} className="m-0">
                  <ScrollArea className="h-64">
                    <div className="grid grid-cols-3 gap-2 p-3">
                      {stickers.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => onSelect(s)}
                          className="rounded-lg border bg-card hover:bg-accent transition-colors p-2"
                          title={s.name}
                        >
                          <img src={s.url} alt={s.name} className="w-full h-20 object-contain" />
                        </button>
                      ))}
                      {stickers.length === 0 && (
                        <div className="col-span-3 text-sm text-muted-foreground">Bá»™ nĂ y chÆ°a cĂ³ sticker</div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </PopoverContent>
    </Popover>
  );
}
