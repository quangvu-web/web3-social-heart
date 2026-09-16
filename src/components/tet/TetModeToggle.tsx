import { Switch } from '@/components/ui/switch';
import { useTetTheme } from '@/contexts/TetThemeContext';
import { Sparkles } from 'lucide-react';

interface TetModeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export function TetModeToggle({ showLabel = true, className = '' }: TetModeToggleProps) {
  const { tetModeEnabled, toggleTetMode } = useTetTheme();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" />
          <span className="text-sm font-medium">Tết Mode</span>
        </div>
      )}
      <Switch
        checked={tetModeEnabled}
        onCheckedChange={toggleTetMode}
        className="data-[state=checked]:bg-gold"
      />
      {!showLabel && (
        <Sparkles className={`w-4 h-4 transition-colors ${tetModeEnabled ? 'text-gold' : 'text-muted-foreground'}`} />
      )}
    </div>
  );
}
