import { CloudOff } from 'lucide-react';
import { useOnline } from '../../hooks/useOnline';
import { cn } from '../../lib/cn';

export function OnlineIndicator({ compact = false }: { compact?: boolean }) {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex min-h-8 items-center gap-2 border-b bg-warn-soft px-4 text-caption-1-medium text-warn',
        compact ? 'border-transparent px-0' : 'border-line',
      )}
    >
      <CloudOff aria-hidden className="size-3.5 shrink-0" />
      <span>Offline — reports are saved locally and will send when connected</span>
    </div>
  );
}
