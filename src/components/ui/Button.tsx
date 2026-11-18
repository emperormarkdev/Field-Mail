import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-button-primary text-text-white shadow-xs',
  secondary:
    'border border-line-strong bg-surface text-ink shadow-2xs hover:bg-raised hover:border-border-button-hover',
  ghost: 'bg-transparent text-muted hover:bg-raised hover:text-ink',
  danger: 'bg-button-danger text-text-white shadow-xs',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-10 px-3.5 text-body-semibold',
  lg: 'min-h-11 px-4 text-body-semibold',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    fullWidth,
    loading,
    iconLeft,
    iconRight,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'press inline-flex cursor-pointer items-center justify-center gap-2 rounded-field whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" /> : iconLeft}
      <span className="truncate">{children}</span>
      {iconRight}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', active, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'press inline-flex shrink-0 cursor-pointer items-center justify-center rounded-field outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        size === 'md' ? 'size-10' : 'size-9',
        active && 'bg-accent-soft text-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
