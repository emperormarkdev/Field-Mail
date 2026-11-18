import { Link } from 'react-router-dom';
import { ChevronRight, MapPin } from 'lucide-react';
import type { Report } from '../types';
import { StatusBadge } from './ui/Badge';
import { formatDate, relativeTime, truncate } from '../lib/format';

export function ReportCard({ report, compact = false }: { report: Report; compact?: boolean }) {
  const summary = report.templateSnapshot.fields
    .filter((field) => field.type === 'long' || field.type === 'short')
    .map((field) => report.values[field.id])
    .find((value) => typeof value === 'string' && value.trim().length > 0);

  return (
    <Link
      to={`/reports/${report.id}`}
      className="press group flex items-center gap-3 rounded-card border border-line bg-surface px-3.5 py-3 shadow-card hover:border-line-strong hover:bg-raised sm:px-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-body-semibold text-ink">{report.templateName}</p>
          <StatusBadge status={report.status} />
        </div>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-body-2-regular text-muted">
          <MapPin aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{report.siteName || 'No site named'}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{formatDate(report.reportDate)}</span>
        </p>
        {!compact && summary && (
          <p className="mt-1 truncate text-body-2-regular text-muted">
            {truncate(String(summary), 110)}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-caption-1-regular text-muted">
          {report.status === 'sent' && report.sentAt
            ? relativeTime(report.sentAt)
            : relativeTime(report.updatedAt)}
        </span>
        <ChevronRight aria-hidden className="size-4 text-muted group-hover:text-ink" />
      </div>
    </Link>
  );
}
