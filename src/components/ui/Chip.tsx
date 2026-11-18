import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export function Chip({
  children,
  selected,
  onClick,
  icon,
  className,
  disabled,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'press inline-flex min-h-12 items-center gap-2 rounded-chip border px-4 text-[0.9375rem] font-medium',
        'disabled:opacity-45 disabled:pointer-events-none',
        selected
          ? 'border-accent/40 bg-accent-soft text-accent'
          : 'border-line-strong bg-surface text-ink hover:bg-raised',
        className,
      )}
    >
      {selected ? <Check aria-hidden className="size-4 shrink-0" /> : icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function StaticChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-chip border border-line bg-raised px-2.5 py-1 text-[0.75rem] font-medium text-muted',
        className,
      )}
    >
      {children}
    </span>
  );
}
