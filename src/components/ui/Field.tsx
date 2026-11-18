import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

const CONTROL = [
  'w-full rounded-field border bg-surface text-body-regular text-ink placeholder:text-text-placeholder',
  'border-line-strong transition-colors',
  'focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
  'disabled:opacity-50 disabled:cursor-not-allowed',
].join(' ');

export interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
  compact,
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className={cn(
          'text-ink',
          compact ? 'text-body-2-medium text-muted' : 'text-body-medium',
        )}
      >
        {label}
        {required && (
          <span className="ms-1 text-danger" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only">(required)</span>}
      </label>
      {hint && !error && <p className="-mt-0.5 text-body-2-regular text-muted">{hint}</p>}
      {children}
      {error && (
        <p className="text-body-2-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(CONTROL, 'min-h-10 px-3', className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          CONTROL,
          'min-h-24 resize-y px-3 py-2.5',
          'field-sizing-content max-h-[70dvh]',
          className,
        )}
        {...rest}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(CONTROL, 'min-h-10 appearance-none ps-3 pe-9', className)}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
      </div>
    );
  },
);

export function TextField({
  label,
  hint,
  error,
  required,
  className,
  ...rest
}: FieldProps & InputHTMLAttributes<HTMLInputElement> & { children?: never }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} required={required} className={className}>
      <Input id={id} aria-invalid={!!error} {...rest} />
    </Field>
  );
}
