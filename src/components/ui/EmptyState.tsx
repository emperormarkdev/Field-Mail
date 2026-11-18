import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-3 grid size-12 place-items-center rounded-full bg-raised text-muted">
          {icon}
        </div>
      )}
      <p className="text-[0.9375rem] font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-[0.875rem] leading-relaxed text-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
