import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, FileText, Pencil, Plus } from 'lucide-react';
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
  const reports = useLiveQuery(
    () => db.reports.orderBy('updatedAt').reverse().limit(5).toArray(),
    [],
    null,
  );
  const latestDraft = useLiveQuery(
    async () => {
      const drafts = await db.reports.where('status').equals('draft').toArray();
      drafts.sort((a, b) => b.updatedAt - a.updatedAt);
      return drafts[0] ?? null;
    },
    [],
    null,
  );

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pb-10 sm:px-6">
      <PageHeader
        title="Home"
        sticky={false}
        actions={
          <Link to="/new">
            <Button variant="primary" iconLeft={<Plus aria-hidden className="size-4" />}>
              New report
            </Button>
          </Link>
        }
      />

      <OutboxStrip />

      {latestDraft && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent/35 bg-accent-soft px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-accent">
              <Pencil aria-hidden className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-body-semibold text-ink">
                Unfinished draft: {latestDraft.templateName}
              </p>
              <p className="truncate text-body-2-regular text-muted">
                {latestDraft.siteName || 'No site named'} · {formatDate(latestDraft.reportDate)} · saved{' '}
                {relativeTime(latestDraft.updatedAt)}
              </p>
            </div>
          </div>
          <Link
            to={`/reports/${latestDraft.id}/edit`}
            className="press inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-field bg-accent px-3 text-body-2-semibold text-on-accent hover:bg-accent-hover"
          >
            Continue draft
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </div>
      )}

      <section className="mt-5" aria-labelledby="templates-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="templates-heading" className="text-body-semibold text-ink">
            Start a new report
          </h2>
          <Link
            to="/templates"
            className="press text-body-2-semibold text-accent hover:underline"
          >
            Edit templates
          </Link>
        </div>

        {templates === null ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-card border border-line bg-surface p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2.5 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={<FileText aria-hidden className="size-5" />}
            title="No templates"
            description="Create a template to start writing reports."
            action={
              <Link to="/templates/new">
                <Button variant="primary">Create template</Button>
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <li key={template.id}>
                <Link
                  to={`/reports/new/${template.id}`}
                  className="press group flex h-full flex-col justify-between rounded-card border border-line bg-surface p-4 shadow-card hover:border-line-strong hover:bg-raised"
                >
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-body-semibold text-ink">{template.name}</p>
                      <ArrowRight
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                      />
                    </div>
                    {template.description && (
                      <p className="mt-1 line-clamp-2 text-body-2-regular text-muted">
                        {template.description}
                      </p>
                    )}
                  </div>
                  <p className="mt-3 text-caption-1-medium text-muted">
                    {template.fields.length} {plural(template.fields.length, 'field')}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-labelledby="recent-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="recent-heading" className="text-body-semibold text-ink">
            Recent reports
          </h2>
          <Link
            to="/reports"
            className="press text-body-2-semibold text-accent hover:underline"
          >
            View all
          </Link>
        </div>
        {reports === null ? (
          <ListSkeleton rows={2} />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<FileText aria-hidden className="size-5" />}
            title="No reports yet"
            description="Tap a template above to write your first report."
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
  );
}
