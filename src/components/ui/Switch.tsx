import { cn } from '../../lib/cn';

export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  id?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label
          htmlFor={id}
          className="block cursor-pointer text-[0.9375rem] font-medium text-ink"
        >
          {label}
        </label>
        {description && (
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">{description}</p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'press relative mt-0.5 h-8 w-14 shrink-0 rounded-chip border transition-colors',
          checked ? 'border-accent bg-accent' : 'border-line-strong bg-raised',
        )}
      >
        <span
          className={cn(
            'absolute top-1 size-6 rounded-full bg-white shadow-sm transition-[left] duration-150',
            checked ? 'left-[1.75rem]' : 'left-1',
          )}
        />
      </button>
    </div>
  );
}
