import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, FilePlus2 } from 'lucide-react';
import { db } from '../db/db';
import { PageHeader } from '../components/ui/PageHeader';
import { ListSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { plural } from '../lib/format';

export function NewReportPage() {
  const templates = useLiveQuery(() => db.templates.orderBy('name').toArray(), [], null);

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pb-10 sm:px-6">
      <PageHeader title="New report" backTo="/" sticky={false} />

      {templates === null ? (
        <ListSkeleton rows={3} />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<FilePlus2 aria-hidden className="size-5" />}
          title="No templates available"
          description="Create a template first to define the fields for your report."
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
                className="press group flex items-center gap-3.5 rounded-card border border-line bg-surface p-4 shadow-card hover:border-line-strong hover:bg-raised"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-field bg-accent-soft text-accent">
                  <FilePlus2 aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body-semibold text-ink">{template.name}</span>
                  <span className="mt-0.5 block text-body-2-regular text-muted">
                    {template.description || `${template.fields.length} ${plural(template.fields.length, 'field')}`}
                  </span>
                </span>
                <ArrowRight aria-hidden className="size-4 shrink-0 text-muted group-hover:text-ink" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
