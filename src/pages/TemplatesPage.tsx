import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, LayoutTemplate, Pencil, Plus, Trash2 } from 'lucide-react';
import { db } from '../db/db';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button, IconButton } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { newId } from '../lib/id';
import { plural } from '../lib/format';
import type { Template } from '../types';

export function TemplatesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const templates = useLiveQuery(() => db.templates.orderBy('name').toArray(), [], null);

  const duplicate = (template: Template) => {
    const now = Date.now();
    const copy: Template = {
      ...structuredClone(template),
      id: newId(),
      name: `${template.name} (copy)`,
      isStarter: false,
      createdAt: now,
      updatedAt: now,
    };
    void db.templates.add(copy).then(() =>
      toast.show({ message: 'Template duplicated.', tone: 'success' }),
    );
  };

  const remove = (template: Template) => {
    void db.templates.delete(template.id).then(() =>
      toast.show({
        message: `${template.name} deleted.`,
        action: {
          label: 'Undo',
          onClick: () => void db.templates.put(template),
        },
      }),
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pb-8 sm:px-6">
      <PageHeader
        title="Templates"
        actions={
          <Button
            variant="primary"
            onClick={() => navigate('/templates/new')}
            iconLeft={<Plus aria-hidden className="size-4" />}
          >
            New template
          </Button>
        }
      />

      {templates === null ? (
        <ListSkeleton rows={3} />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate aria-hidden className="size-5" />}
          title="No templates"
          description="Create a template to define the fields for your reports."
          action={
            <Button variant="primary" onClick={() => navigate('/templates/new')}>
              Create template
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <li key={template.id} className="min-w-0">
              <Card className="flex h-full flex-col justify-between p-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/templates/${template.id}`)}
                      className="min-w-0 flex-1 cursor-pointer text-start"
                    >
                      <span className="block text-body-semibold text-ink hover:text-accent">
                        {template.name}
                      </span>
                    </button>
                    <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-caption-2-medium text-muted">
                      {template.fields.length} {plural(template.fields.length, 'field')}
                    </span>
                  </div>
                  {template.description && (
                    <p className="mt-1 line-clamp-2 text-body-2-regular text-muted">
                      {template.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
                  <Link
                    to={`/reports/new/${template.id}`}
                    className="press inline-flex h-8 items-center rounded-lg bg-accent-soft px-3 text-caption-1-semibold text-accent hover:bg-accent hover:text-white"
                  >
                    Write report
                  </Link>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconButton
                      label={`Edit ${template.name}`}
                      size="sm"
                      onClick={() => navigate(`/templates/${template.id}`)}
                    >
                      <Pencil aria-hidden className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Duplicate ${template.name}`}
                      size="sm"
                      onClick={() => duplicate(template)}
                    >
                      <Copy aria-hidden className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Delete ${template.name}`}
                      size="sm"
                      variant="danger"
                      onClick={() => remove(template)}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </IconButton>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
