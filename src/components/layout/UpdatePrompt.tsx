import { RefreshCw } from 'lucide-react';
import { useRuntime } from '../../app/AppRuntime';
import { Button } from '../ui/Button';

export function UpdatePrompt() {
  const { needRefresh, applyUpdate } = useRuntime();
  if (!needRefresh) return null;

  return (
    <div className="sticky top-0 z-40 border-b border-accent/30 bg-accent-soft px-4 py-2">
      <div className="mx-auto flex max-w-[1120px] items-center gap-3">
        <RefreshCw aria-hidden className="size-4 shrink-0 text-accent" />
        <p className="min-w-0 flex-1 text-[0.875rem] font-medium text-accent">
          Update available. Tap to refresh.
        </p>
        <Button
          variant="primary"
          onClick={applyUpdate}
          className="min-h-10 px-3 py-1 text-[0.8125rem]"
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}
