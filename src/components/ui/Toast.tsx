import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ToastTone = 'default' | 'success' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  action?: ToastAction;
  duration?: number;
}

interface ToastRecord extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  show: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      const id = ++counter.current;
      const duration = options.duration ?? (options.action ? 8000 : 4000);
      setToasts((current) => [...current.slice(-2), { ...options, id }]);
      if (duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
    },
    [],
  );

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'animate-rise pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-card border px-4 py-3 shadow-lg',
              'bg-surface text-ink',
              toast.tone === 'error' && 'border-danger/35',
              toast.tone === 'success' && 'border-ok/35',
              (!toast.tone || toast.tone === 'default') && 'border-line-strong',
            )}
          >
            {toast.tone === 'success' && (
              <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-ok" />
            )}
            {toast.tone === 'error' && (
              <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" />
            )}
            <p className="min-w-0 flex-1 text-[0.9375rem] leading-snug">{toast.message}</p>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  dismiss(toast.id);
                }}
                className="press -my-1 shrink-0 rounded-field px-2 py-1 text-[0.9375rem] font-semibold text-accent hover:bg-accent-soft"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="press -mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-field text-muted hover:bg-raised"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
