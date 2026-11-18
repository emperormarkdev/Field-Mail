import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Moon, Sun } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { cn } from '../../lib/cn';

export function PageHeader({
  title,
  description,
  backTo,
  backLabel = 'Back',
  actions,
  sticky = true,
  className,
}: {
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  const { resolvedTheme, toggleTheme } = useSettings();

  return (
    <header
      className={cn(
        'z-20 bg-canvas/95 backdrop-blur-sm',
        sticky && 'sticky top-0',
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-[1120px] items-center gap-3 py-4">
        {backTo && (
          <Link
            to={backTo}
            aria-label={backLabel}
            className="press -ms-1 grid size-9 shrink-0 place-items-center rounded-field border border-line bg-surface text-ink hover:bg-raised"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-title-2-semibold text-ink">{title}</h1>
          {description && (
            <p className="mt-0.5 text-body-2-regular text-muted">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="press grid size-9 place-items-center rounded-field border border-line bg-surface text-muted hover:bg-raised hover:text-ink lg:hidden"
          >
            {resolvedTheme === 'dark' ? (
              <Sun aria-hidden className="size-4" />
            ) : (
              <Moon aria-hidden className="size-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
