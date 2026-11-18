import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RiArrowLeftLine } from '@remixicon/react';
import { cn } from '../../lib/cn';

export function PageHeader({
  title,
  description,
  backTo,
  backLabel = 'Back',
  actions,
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
  return (
    <header className={cn('pt-4 pb-3 sm:pt-5 sm:pb-4', className)}>
      <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {backTo && (
            <Link
              to={backTo}
              aria-label={backLabel}
              className="press -ms-1 grid size-9 shrink-0 place-items-center rounded-full text-ink hover:bg-raised"
            >
              <RiArrowLeftLine aria-hidden className="size-5" />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <h1
              className={cn(
                'truncate text-ink',
                backTo ? 'text-headline-semibold sm:text-title-2-semibold' : 'text-title-1-semibold',
              )}
            >
              {title}
            </h1>
            {description && (
              <p className="mt-0.5 truncate text-body-2-regular text-muted">
                {description}
              </p>
            )}
          </div>
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
