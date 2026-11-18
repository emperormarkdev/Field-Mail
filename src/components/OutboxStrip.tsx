import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, RefreshCw } from 'lucide-react';
import { useOutbox } from '../hooks/useOutbox';
import { useToast } from './ui/Toast';
import { plural } from '../lib/format';
import { cn } from '../lib/cn';

export function OutboxStrip() {
  const { count, failedCount, retry } = useOutbox();
  const toast = useToast();

  if (count === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-card border px-4 py-3',
        failedCount > 0 ? 'border-danger/30 bg-danger-soft' : 'border-warn/30 bg-warn-soft',
      )}
    >
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full',
          failedCount > 0 ? 'bg-surface text-danger' : 'bg-surface text-warn',
        )}
      >
        {failedCount > 0 ? (
          <RefreshCw aria-hidden className="size-4" />
        ) : (
          <Clock3 aria-hidden className="size-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-semibold text-ink">
          {count} {plural(count, 'report')} waiting to send
        </p>
        <p className="text-body-2-regular text-muted">
          {failedCount > 0
            ? `${failedCount} could not be sent yet.`
            : 'Will send automatically as soon as internet connects.'}
        </p>
      </div>
      {failedCount > 0 && (
        <button
          type="button"
          onClick={() => {
            void retry().then(() => toast.show({ message: 'Trying again…', tone: 'default' }));
          }}
          className="press min-h-9 cursor-pointer rounded-field border border-line-strong bg-surface px-3 text-body-2-semibold text-ink hover:bg-raised"
        >
          Try again
        </button>
      )}
      <Link
        to="/reports"
        className="press inline-flex min-h-9 items-center gap-1 rounded-field px-2 text-body-2-semibold text-accent hover:underline"
      >
        View <ArrowRight aria-hidden className="size-3.5" />
      </Link>
    </div>
  );
}
