import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RiAddLine,
  RiArrowRightSLine,
  RiCheckboxCircleLine,
  RiDraftLine,
  RiFileList3Line,
  RiFileTextLine,
  RiTimeLine,
} from '@remixicon/react';
import { db } from '../db/db';
import { OutboxStrip } from '../components/OutboxStrip';
import { ReportCard } from '../components/ReportCard';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { ListSkeleton, Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDate, plural, relativeTime } from '../lib/format';

export function HomePage() {
  const templates = useLiveQuery(() => db.templates.orderBy('name').toArray(), [], null);
  const allReports = useLiveQuery(
    () => db.reports.orderBy('updatedAt').reverse().toArray(),
    [],
    null,
  );

  const reports = allReports ? allReports.slice(0, 6) : null;
  const latestDraft = allReports?.find((r) => r.status === 'draft') ?? null;

  const stats = {
    sent: allReports?.filter((r) => r.status === 'sent').length ?? 0,
    drafts: allReports?.filter((r) => r.status === 'draft').length ?? 0,
    waiting:
      allReports?.filter((r) => r.status === 'queued' || r.status === 'sending' || r.status === 'failed')
        .length ?? 0,
  };

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pb-8 sm:px-6">
      <PageHeader
        title="Fieldmail"
        description="Write offline, send as email text & printable PDF"
        actions={
          <Link to="/new" className="hidden sm:inline-flex">
            <Button variant="primary" iconLeft={<RiAddLine aria-hidden className="size-4.5" />}>
              New report
            </Button>
          </Link>
        }
      />

      <OutboxStrip />

      {allReports && allReports.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2.5 sm:gap-3">
          <Link
            to="/reports"
            className="press flex items-center gap-2.5 rounded-card border border-line bg-surface p-3 shadow-card hover:bg-raised sm:p-3.5"
          >
            <span className=" hidden size-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 sm:grid">
              <RiCheckboxCircleLine aria-hidden className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-headline-bold text-ink sm:text-title-3-bold">{stats.sent}</p>
              <p className="truncate text-caption-1-medium text-muted">Sent</p>
            </div>
          </Link>
          <Link
            to="/reports"
            className="press flex items-center gap-2.5 rounded-card border border-line bg-surface p-3 shadow-card hover:bg-raised sm:p-3.5"
          >
            <span className="hidden size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent sm:grid">
              <RiDraftLine aria-hidden className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-headline-bold text-ink sm:text-title-3-bold">{stats.drafts}</p>
              <p className="truncate text-caption-1-medium text-muted">Drafts</p>
            </div>
          </Link>
          <Link
            to="/reports"
            className="press flex items-center gap-2.5 rounded-card border border-line bg-surface p-3 shadow-card hover:bg-raised sm:p-3.5"
          >
            <span className="hidden size-9 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600 sm:grid">
              <RiTimeLine aria-hidden className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-headline-bold text-ink sm:text-title-3-bold">{stats.waiting}</p>
              <p className="truncate text-caption-1-medium text-muted">Waiting</p>
            </div>
          </Link>
        </div>
      )}

      {latestDraft && (
        <Link
          to={`/reports/${latestDraft.id}/edit`}
          className="press mt-3 flex items-center justify-between gap-3 rounded-card border border-accent/35 bg-accent-soft px-3.5 py-3 sm:px-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-white">
              <RiDraftLine aria-hidden className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-body-semibold text-ink">
                Continue: {latestDraft.templateName}
              </p>
              <p className="truncate text-caption-1-regular text-muted">
                {latestDraft.siteName || 'No site named'} · {formatDate(latestDraft.reportDate)} ·{' '}
                {relativeTime(latestDraft.updatedAt)}
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-caption-1-semibold text-white">
            Resume
            <RiArrowRightSLine aria-hidden className="size-4" />
          </span>
        </Link>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <section aria-labelledby="templates-heading">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <h2 id="templates-heading" className="text-body-semibold text-ink">
              Start a report
            </h2>
            <Link
              to="/templates"
              className="press text-caption-1-semibold text-accent hover:underline"
            >
              Manage templates
            </Link>
          </div>

          {templates === null ? (
            <div className="flex flex-col gap-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-card border border-line bg-surface p-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="mt-2 h-3 w-full" />
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <EmptyState
              icon={<RiFileTextLine aria-hidden className="size-5" />}
              title="No templates"
              description="Create a template to start writing reports."
              action={
                <Link to="/templates/new">
                  <Button variant="primary">Create template</Button>
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {templates.map((template) => (
                <li key={template.id}>
                  <Link
                    to={`/reports/new/${template.id}`}
                    className="press group flex items-center gap-3.5 rounded-card border border-line bg-surface p-3.5 shadow-card hover:border-line-strong hover:bg-raised sm:p-4"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                      <RiFileList3Line aria-hidden className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-body-semibold text-ink">{template.name}</p>
                        <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-caption-2-medium text-muted">
                          {template.fields.length} {plural(template.fields.length, 'field')}
                        </span>
                      </div>
                      {template.description && (
                        <p className="mt-0.5 line-clamp-1 text-body-2-regular text-muted">
                          {template.description}
                        </p>
                      )}
                    </div>
                    <RiArrowRightSLine
                      aria-hidden
                      className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent-heading">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <h2 id="recent-heading" className="text-body-semibold text-ink">
              Recent reports
            </h2>
            <Link
              to="/reports"
              className="press text-caption-1-semibold text-accent hover:underline"
            >
              View all
            </Link>
          </div>
          {reports === null ? (
            <ListSkeleton rows={3} />
          ) : reports.length === 0 ? (
            <EmptyState
              icon={<RiFileTextLine aria-hidden className="size-5" />}
              title="No reports yet"
              description="Tap any template to write your first report."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {reports.map((report) => (
                <li key={report.id}>
                  <ReportCard report={report} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
