import { AlertCircle, Check, Clock, Loader2, PencilLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import type { ReportStatus } from '../../types';

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';

const TONES: Record<Tone, string> = {
  neutral: 'bg-raised text-muted border-line',
  accent: 'bg-accent-soft text-accent border-accent/25',
  ok: 'bg-ok-soft text-ok border-ok/25',
  warn: 'bg-warn-soft text-warn border-warn/30',
  danger: 'bg-danger-soft text-danger border-danger/30',
};

export function Badge({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-chip border px-2.5 py-1 text-[0.75rem] font-semibold leading-none',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

const STATUS: Record<
  ReportStatus,
  { label: string; tone: Tone; icon: ReactNode }
> = {
  draft: { label: 'Draft', tone: 'neutral', icon: <PencilLine aria-hidden className="size-3.5" /> },
  queued: { label: 'Waiting to send', tone: 'warn', icon: <Clock aria-hidden className="size-3.5" /> },
  sending: { label: 'Sending', tone: 'accent', icon: <Loader2 aria-hidden className="size-3.5 animate-spin" /> },
  sent: { label: 'Sent', tone: 'ok', icon: <Check aria-hidden className="size-3.5" /> },
  failed: { label: 'Not sent', tone: 'danger', icon: <AlertCircle aria-hidden className="size-3.5" /> },
};

export function StatusBadge({ status, className }: { status: ReportStatus; className?: string }) {
  const meta = STATUS[status];
  return (
    <Badge tone={meta.tone} icon={meta.icon} className={className}>
      {meta.label}
    </Badge>
  );
}

export function statusLabel(status: ReportStatus): string {
  return STATUS[status].label;
}
