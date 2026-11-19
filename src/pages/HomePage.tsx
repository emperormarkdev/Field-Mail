import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RiAddLine,
  RiArrowRightSLine,
  RiDraftLine,
  RiFileList3Line,
  RiFileTextLine,
  RiMailSettingsLine,
} from '@remixicon/react';
import { db } from '../db/db';
import { useSettings } from '../hooks/useSettings';
import { OutboxStrip } from '../components/OutboxStrip';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ListSkeleton, Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDate, relativeTime } from '../lib/format';

function getGreeting(name?: string): string {
  const hour = new Date().getHours();
  const base = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${base}, ${first}` : base;
}

function getTodayLabel(): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date());
}

export function HomePage() {
  const { settings } = useSettings();
  const templates = useLiveQuery(() => db.templates.orderBy('name').toArray(), [], null);
  const allReports = useLiveQuery(
    () => db.reports.orderBy('updatedAt').reverse().toArray(),
    [],
    null,
  );

  const visibleTemplates = templates ? templates.slice(0, 4) : null;
  const recentReports = allReports ? allReports.slice(0, 5) : null;
  const latestDraft = allReports?.find((r) => r.status === 'draft') ?? null;
  const needsEmailSetup = Boolean(settings && (!settings.gmail.trim() || !settings.accessKey.trim()));

  return (
    <div className="mx-auto w-full max-w-3xl overflow-x-hidden px-4 pt-6 pb-12 sm:px-6 sm:pt-8">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-caption-1-medium text-muted">{getTodayLabel()}</p>
          <h1 className="mt-0.5 truncate text-title-2-semibold text-ink sm:text-title-1-medium">
            {getGreeting(settings?.myName)}
          </h1>
        </div>
        <Link to="/new" className="shrink-0">
          <Button variant="primary" size="md" iconLeft={<RiAddLine aria-hidden className="size-4.5" />}>
            New report
          </Button>
        </Link>
      </header>

      <div className="flex flex-col gap-7">
        <OutboxStrip />

        {latestDraft && (
          <Link
            to={`/reports/${latestDraft.id}/edit`}
            className="press group flex w-full min-w-0 items-center justify-between gap-3 rounded-card border border-accent/25 bg-accent-soft/75 px-4 py-3.5 transition-colors hover:border-accent/45 hover:bg-accent-soft"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-on-accent">
                <RiDraftLine aria-hidden className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-semibold text-ink">
                  {latestDraft.templateName}
                </p>
                <p className="truncate text-caption-1-regular text-muted">
                  Draft · {latestDraft.siteName || 'No site named'} · {relativeTime(latestDraft.updatedAt)}
                </p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-0.5 text-body-2-semibold text-accent">
              Continue
              <RiArrowRightSLine
                aria-hidden
                className="size-4 transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </Link>
        )}

        <section className="min-w-0" aria-labelledby="quick-start-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="quick-start-heading" className="text-body-2-semibold text-muted">
              Start a report
            </h2>
            <Link
              to="/templates"
              className="press text-caption-1-semibold text-accent hover:underline"
            >
              All templates
            </Link>
          </div>

          {visibleTemplates === null ? (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-card border border-line bg-surface p-4">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="mt-3 h-4 w-3/4" />
                  <Skeleton className="mt-1.5 h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : visibleTemplates.length === 0 ? (
            <EmptyState
              icon={<RiFileTextLine aria-hidden className="size-5" />}
              title="No templates yet"
              description="Create a template to start writing field reports."
              action={
                <Link to="/templates/new">
                  <Button variant="primary">Create template</Button>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {visibleTemplates.map((template) => (
                <Link
                  key={template.id}
                  to={`/reports/new/${template.id}`}
                  className="press group flex min-w-0 flex-col justify-between rounded-card border border-line bg-surface p-3.5 transition-colors hover:border-line-strong hover:bg-raised sm:p-4"
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent">
                    <RiFileList3Line aria-hidden className="size-4.5" />
                  </span>
                  <div className="mt-3 min-w-0">
                    <p className="truncate text-body-semibold text-ink">{template.name}</p>
                    {template.description && (
                      <p className="mt-0.5 line-clamp-1 text-caption-1-regular text-muted">
                        {template.description}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0" aria-labelledby="recent-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="recent-heading" className="text-body-2-semibold text-muted">
              Recent reports
            </h2>
            {allReports && allReports.length > 0 && (
              <Link
                to="/reports"
                className="press text-caption-1-semibold text-accent hover:underline"
              >
                View all ({allReports.length})
              </Link>
            )}
          </div>

          {recentReports === null ? (
            <ListSkeleton rows={3} />
          ) : recentReports.length === 0 ? (
            <div className="rounded-card border border-dashed border-line-strong bg-surface/60 px-5 py-8 text-center">
              <p className="text-body-medium text-ink">No reports yet</p>
              <p className="mt-1 text-body-2-regular text-muted">
                Pick any template above to write and send your first report.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
              {recentReports.map((report) => (
                <li key={report.id}>
                  <Link
                    to={`/reports/${report.id}`}
                    className="press group flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-raised"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-body-medium text-ink">{report.templateName}</p>
                        <StatusBadge status={report.status} />
                      </div>
                      <p className="mt-0.5 truncate text-caption-1-regular text-muted">
                        {report.siteName || 'No site named'} · {formatDate(report.reportDate)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-caption-1-regular text-muted">
                      <span className="hidden sm:inline">
                        {report.status === 'sent' && report.sentAt
                          ? relativeTime(report.sentAt)
                          : relativeTime(report.updatedAt)}
                      </span>
                      <RiArrowRightSLine
                        aria-hidden
                        className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {needsEmailSetup && (
          <Link
            to="/settings"
            className="press flex items-center justify-between gap-3 rounded-card border border-line bg-raised/60 px-4 py-3 text-body-2-regular text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <RiMailSettingsLine aria-hidden className="size-4 shrink-0 text-accent" />
              <span className="truncate">Connect your email in Settings to start sending reports</span>
            </span>
            <RiArrowRightSLine aria-hidden className="size-4 shrink-0" />
          </Link>
        )}
      </div>
    </div>
  );
}
