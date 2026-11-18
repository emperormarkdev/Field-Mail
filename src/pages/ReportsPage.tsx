import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RiAddLine,
  RiCalendarEventLine,
  RiCloseLine,
  RiDownload2Line,
  RiEditLine,
  RiFileTextLine,
  RiSearchLine,
} from '@remixicon/react';
import { db } from '../db/db';
import { useSettings } from '../hooks/useSettings';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useToast } from '../components/ui/Toast';
import { PageHeader } from '../components/ui/PageHeader';
import { ReportCard } from '../components/ReportCard';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Input, Select } from '../components/ui/Field';
import { Sheet } from '../components/ui/Sheet';
import { EmptyState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { downloadBlob } from '../lib/backup';
import { formatDate, formatDateTime, isoFromDate, plural, todayIso, truncate } from '../lib/format';
import { buildPdfBlob, buildSummaryPdfBlob, pdfFilename, summaryPdfFilename } from '../lib/pdf';
import { cn } from '../lib/cn';
import type { Report } from '../types';

type Filter = 'all' | 'waiting' | 'sent' | 'drafts' | 'failed';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'sent', label: 'Sent' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'failed', label: 'Not sent' },
];

function matchesFilter(report: Report, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'waiting') return report.status === 'queued' || report.status === 'sending';
  if (filter === 'sent') return report.status === 'sent';
  if (filter === 'drafts') return report.status === 'draft';
  return report.status === 'failed';
}

function matchesSearch(report: Report, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (report.templateName.toLowerCase().includes(q)) return true;
  if (report.siteName.toLowerCase().includes(q)) return true;
  if (report.reportDate.includes(q)) return true;
  for (const val of Object.values(report.values)) {
    if (typeof val === 'string' && val.toLowerCase().includes(q)) return true;
    if (Array.isArray(val) && val.some((item) => item.toLowerCase().includes(q))) return true;
  }
  return false;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return isoFromDate(d);
}

export function ReportsPage() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const toast = useToast();
  const split = useMediaQuery('(min-width: 1024px)');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [startDate, setStartDate] = useState(() => daysAgoIso(6));
  const [endDate, setEndDate] = useState(() => todayIso());
  const [siteFilter, setSiteFilter] = useState('');
  const [buildingSummary, setBuildingSummary] = useState(false);

  const reports = useLiveQuery(
    () => db.reports.orderBy('updatedAt').reverse().toArray(),
    [],
    null,
  );

  const counts = useMemo(() => {
    const all = reports ?? [];
    return {
      all: all.length,
      waiting: all.filter((r) => matchesFilter(r, 'waiting')).length,
      sent: all.filter((r) => matchesFilter(r, 'sent')).length,
      drafts: all.filter((r) => matchesFilter(r, 'drafts')).length,
      failed: all.filter((r) => matchesFilter(r, 'failed')).length,
    };
  }, [reports]);

  const knownSites = useMemo(() => {
    const set = new Set<string>();
    for (const r of reports ?? []) {
      const s = r.siteName.trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [reports]);

  const summaryReports = useMemo(() => {
    return (reports ?? []).filter((r) => {
      if (startDate && r.reportDate < startDate) return false;
      if (endDate && r.reportDate > endDate) return false;
      if (siteFilter && r.siteName.trim() !== siteFilter) return false;
      return true;
    });
  }, [reports, startDate, endDate, siteFilter]);

  const visible = useMemo(
    () =>
      (reports ?? []).filter(
        (report) => matchesFilter(report, filter) && matchesSearch(report, search),
      ),
    [reports, filter, search],
  );

  useEffect(() => {
    if (!split) return;
    if (visible.length > 0 && (!selectedId || !visible.some((r) => r.id === selectedId))) {
      setSelectedId(visible[0].id);
    }
  }, [split, visible, selectedId]);

  const selected = visible.find((report) => report.id === selectedId) ?? visible[0] ?? null;

  const open = (report: Report) => {
    if (split) setSelectedId(report.id);
    else navigate(`/reports/${report.id}`);
  };

  const downloadSinglePdf = async (report: Report) => {
    if (!settings) return;
    const photos = await db.photos.where('reportId').equals(report.id).toArray();
    const blob = await buildPdfBlob({ report, photos, settings });
    downloadBlob(blob, pdfFilename(report));
  };

  const handleDownloadSummary = async () => {
    if (!settings) return;
    if (summaryReports.length === 0) {
      toast.show({ message: 'No reports match the selected date range.', tone: 'error' });
      return;
    }
    setBuildingSummary(true);
    try {
      const blob = await buildSummaryPdfBlob({
        reports: summaryReports,
        settings,
        startDate,
        endDate,
        siteFilter: siteFilter || undefined,
      });
      downloadBlob(blob, summaryPdfFilename(startDate, endDate, siteFilter || undefined));
      toast.show({
        message: `Summary PDF downloaded (${summaryReports.length} ${plural(
          summaryReports.length,
          'report',
        )}).`,
        tone: 'success',
      });
      setSummaryOpen(false);
    } catch {
      toast.show({ message: 'Could not generate summary PDF.', tone: 'error' });
    } finally {
      setBuildingSummary(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pb-8 sm:px-6">
      <PageHeader
        title="Reports"
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="secondary"
              onClick={() => setSummaryOpen(true)}
              iconLeft={<RiCalendarEventLine aria-hidden className="size-4" />}
              className="px-2.5 sm:px-3.5"
            >
              <span className="hidden sm:inline">Summary PDF</span>
              <span className="sm:hidden">Summary</span>
            </Button>
            <Link to="/new" className="hidden sm:inline-flex">
              <Button variant="primary" iconLeft={<RiAddLine aria-hidden className="size-4" />}>
                New report
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <RiSearchLine
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search site, template, or notes…"
            aria-label="Search reports"
            className="h-9 w-full rounded-field border border-line-strong bg-surface ps-9 pe-8 text-body-2-regular text-ink placeholder:text-text-placeholder focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute end-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-ink"
            >
              <RiCloseLine aria-hidden className="size-3.5" />
            </button>
          )}
        </div>

        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:px-0">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              aria-pressed={filter === option.key}
              className={cn(
                'press flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-chip border px-3 text-caption-1-semibold',
                filter === option.key
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-line-strong bg-surface text-muted hover:bg-raised hover:text-ink',
              )}
            >
              {option.label}
              <span className={cn('text-caption-2-medium', filter === option.key ? 'opacity-85' : 'opacity-65')}>
                {counts[option.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={cn(split && 'grid grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-6 items-start')}>
        <div className="min-w-0">
          {reports === null ? (
            <ListSkeleton rows={4} />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<RiFileTextLine aria-hidden className="size-5" />}
              title={
                search
                  ? 'No matching reports'
                  : filter === 'all'
                    ? 'No reports yet'
                    : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} reports`
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((report) => {
                const isSelected = split && selected?.id === report.id;
                return (
                  <li
                    key={report.id}
                    className={cn(
                      'rounded-card transition-shadow',
                      isSelected && 'ring-2 ring-accent',
                    )}
                  >
                    <div
                      onClick={(event) => {
                        if (split) {
                          event.preventDefault();
                          open(report);
                        }
                      }}
                    >
                      <ReportCard report={report} compact={split} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {split && selected && (
          <aside className="sticky top-4 min-w-0" aria-label="Report details">
            <div className="rounded-card border border-line bg-surface p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-caption-1-semibold uppercase text-muted">
                    {formatDate(selected.reportDate)}
                  </p>
                  <h2 className="mt-0.5 text-headline-semibold text-ink">
                    {selected.templateName}
                  </h2>
                  <p className="mt-0.5 text-body-2-regular text-muted">
                    {selected.siteName || 'No site named'}
                  </p>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-y border-line py-3">
                {selected.status === 'draft' ? (
                  <Button
                    variant="primary"
                    onClick={() => navigate(`/reports/${selected.id}/edit`)}
                    iconLeft={<RiEditLine aria-hidden className="size-4" />}
                  >
                    Continue editing
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => navigate(`/reports/${selected.id}`)}
                  >
                    Open full report
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => void downloadSinglePdf(selected)}
                  iconLeft={<RiDownload2Line aria-hidden className="size-4" />}
                >
                  Download PDF
                </Button>
                {selected.status === 'draft' && (
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/reports/${selected.id}`)}
                  >
                    Details
                  </Button>
                )}
              </div>

              <dl className="mt-4 flex flex-col gap-3">
                {selected.templateSnapshot.fields
                  .filter((field) => field.type !== 'photo')
                  .map((field) => {
                    const value = selected.values[field.id];
                    if (value == null || (Array.isArray(value) && !value.length)) return null;
                    const str = Array.isArray(value) ? value.join(', ') : String(value);
                    if (!str.trim()) return null;
                    return (
                      <div key={field.id} className="min-w-0 border-b border-line pb-2.5 last:border-b-0 last:pb-0">
                        <dt className="text-caption-1-semibold uppercase text-muted">{field.label}</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap break-words text-body-2-regular text-ink">
                          {truncate(str, 240)}
                        </dd>
                      </div>
                    );
                  })}
              </dl>

              <p className="mt-4 border-t border-line pt-3 text-caption-1-regular text-muted">
                {selected.sentAt
                  ? `Sent ${formatDateTime(selected.sentAt)}`
                  : `Last saved ${formatDateTime(selected.updatedAt)}`}
                {selected.partCount && selected.partCount > 1
                  ? ` · ${selected.partCount} ${plural(selected.partCount, 'email')}`
                  : ''}
              </p>
            </div>
          </aside>
        )}
      </div>

      <Sheet
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        title="Weekly / Date-Range Summary PDF"
        description="Combine multiple reports into one printable black-and-white summary document."
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSummaryOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={buildingSummary}
              disabled={summaryReports.length === 0}
              onClick={() => void handleDownloadSummary()}
              iconLeft={<RiDownload2Line aria-hidden className="size-4" />}
            >
              Download Summary PDF ({summaryReports.length})
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { label: 'Last 7 days', days: 6 },
                { label: 'Last 14 days', days: 13 },
                { label: 'Last 30 days', days: 29 },
              ] as const
            ).map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setStartDate(daysAgoIso(preset.days));
                  setEndDate(todayIso());
                }}
                className="press cursor-pointer rounded-chip border border-line-strong bg-raised px-3 py-1 text-caption-1-semibold text-ink hover:bg-surface"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From date" htmlFor="summary-start">
              <Input
                id="summary-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Field>
            <Field label="To date" htmlFor="summary-end">
              <Input
                id="summary-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Site" htmlFor="summary-site">
            <Select
              id="summary-site"
              value={siteFilter}
              onChange={(event) => setSiteFilter(event.target.value)}
            >
              <option value="">All sites</option>
              {knownSites.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </Select>
          </Field>

          <div className="rounded-card border border-line bg-raised p-3.5">
            <p className="text-body-2-semibold text-ink">
              {summaryReports.length} {plural(summaryReports.length, 'report')} found in this range
            </p>
            {summaryReports.length > 0 ? (
              <ul className="mt-2 flex max-h-44 flex-col divide-y divide-line overflow-y-auto">
                {summaryReports.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 py-1.5 text-body-2-regular">
                    <span className="truncate font-medium text-ink">
                      {item.templateName} ({item.siteName || 'No site'})
                    </span>
                    <span className="shrink-0 text-caption-1-regular text-muted">
                      {formatDate(item.reportDate)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-body-2-regular text-muted">
                Adjust the date range or site filter to include reports.
              </p>
            )}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
