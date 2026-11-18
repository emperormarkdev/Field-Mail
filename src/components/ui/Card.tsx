import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-card border border-line bg-surface shadow-card', className)}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-4 sm:px-5', className)}>
      <div className="min-w-0">
        <h2 className="text-body-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-body-2-regular text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-4 sm:px-5', className)} {...rest} />;
}

export function SectionDivider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-line', className)} />;
}
