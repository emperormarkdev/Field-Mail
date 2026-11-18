import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Plus } from 'lucide-react';
import { db } from '../db/db';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { PageHeader } from '../components/ui/PageHeader';
import { ReportCard } from '../components/ReportCard';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { formatDate, formatDateTime, plural, truncate } from '../lib/format';
import { cn } from '../lib/cn';
import type { Report } from '../types';

type Filter = 'all' | 'waiting' | 'sent' | 'drafts' | 'failed';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'waiting', label: 'Waiting to send' },
  { key: 'sent', label: 'Sent' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'failed', label: 'Not sent' },
];

function matches(report: Report, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'waiting') return report.status === 'queued' || report.status === 'sending';
  if (filter === 'sent') return report.status === 'sent';
  if (filter === 'drafts') return report.status === 'draft';
  return report.status === 'failed';
}

export function ReportsPage() {
  const navigate = useNavigate();
  const split = useMediaQuery('(min-width: 768px)');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reports = useLiveQuery(
    () => db.reports.orderBy('updatedAt').reverse().toArray(),
    [],
    null,
  );

  const counts = useMemo(() => {
    const all = reports ?? [];
    return {
      all: all.length,
      waiting: all.filter((r) => matches(r, 'waiting')).length,
      sent: all.filter((r) => matches(r, 'sent')).length,
      drafts: all.filter((r) => matches(r, 'drafts')).length,
      failed: all.filter((r) => matches(r, 'failed')).length,
    };
  }, [reports]);

  const visible = (reports ?? []).filter((report) => matches(report, filter));
  const selected = (reports ?? []).find((report) => report.id === selectedId) ?? null;

  const open = (report: Report) => {
    if (split) setSelectedId(report.id);
    else navigate(`/reports/${report.id}`);
  };

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pb-10 sm:px-6">
      <PageHeader
        title="Reports"
        sticky={false}
        actions={
          <Link to="/new">
            <Button variant="primary" iconLeft={<Plus aria-hidden className="size-4" />}>
              New report
            </Button>
          </Link>
        }
      />

      <div className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            aria-pressed={filter === option.key}
            className={cn(
              'press flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-chip border px-3 text-body-2-semibold',
              filter === option.key
                ? 'border-accent/40 bg-accent text-on-accent'
                : 'border-line-strong bg-surface text-muted hover:bg-raised',
            )}
          >
            {option.label}
            <span className={cn('text-caption-1-medium', filter === option.key ? 'opacity-80' : 'opacity-60')}>
              {counts[option.key]}
            </span>
          </button>
        ))}
      </div>

      <div className={cn(split && 'grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-5')}>
        <div className="min-w-0">
          {reports === null ? (
            <ListSkeleton rows={4} />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<FileText aria-hidden className="size-5" />}
              title={
                filter === 'all'
                  ? 'No reports yet'
                  : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} reports`
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((report) => (
                <li
                  key={report.id}
                  className={cn(split && selectedId === report.id && 'rounded-card ring-2 ring-accent/40')}
                >
                  <div onClick={() => open(report)} className="cursor-pointer">
                    <ReportCard report={report} compact={split} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {split && (
          <aside className="min-w-0" aria-label="Report summary">
            {selected ? (
              <div className="sticky top-4 rounded-card border border-line bg-surface p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-caption-1-semibold uppercase text-muted">
                      {formatDate(selected.reportDate)}
                    </p>
                    <h2 className="mt-1 text-headline-semibold text-ink">
                      {selected.templateName}
                    </h2>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>
                <p className="mt-1.5 text-body-regular text-muted">{selected.siteName || 'No site named'}</p>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
                  {selected.templateSnapshot.fields
                    .filter((field) => field.type !== 'photo')
                    .slice(0, 8)
                    .map((field) => {
                      const value = selected.values[field.id];
                      if (value == null || (Array.isArray(value) && !value.length)) return null;
                      return (
                        <div key={field.id} className="min-w-0">
                          <dt className="text-caption-1-medium text-muted">{field.label}</dt>
                          <dd className="mt-0.5 break-words text-body-regular text-ink">
                            {truncate(Array.isArray(value) ? value.join(', ') : String(value), 90)}
                          </dd>
                        </div>
                      );
                    })}
                </dl>

                <p className="mt-4 border-t border-line pt-3 text-caption-1-regular text-muted">
                  {selected.sentAt
                    ? `Sent ${formatDateTime(selected.sentAt)}`
                    : `Updated ${formatDateTime(selected.updatedAt)}`}
                  {selected.partCount && selected.partCount > 1
                    ? ` · ${selected.partCount} ${plural(selected.partCount, 'email')}`
                    : ''}
                </p>

                <div className="mt-4">
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => navigate(`/reports/${selected.id}`)}
                  >
                    Open full report
                  </Button>
                </div>
              </div>
            ) : (
              <div className="sticky top-4 flex min-h-60 flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-surface/50 p-6 text-center">
                <FileText aria-hidden className="size-5 text-muted" />
                <p className="mt-2.5 text-body-medium text-muted">
                  Select a report to view summary
                </p>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
