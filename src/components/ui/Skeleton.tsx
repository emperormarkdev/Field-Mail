import { cn } from '../../lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-md', className)} />;
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-card border border-line bg-surface p-4">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="mt-3 h-3 w-3/5" />
          <Skeleton className="mt-2 h-3 w-1/4" />
        </div>
      ))}
    </div>
  );
}
