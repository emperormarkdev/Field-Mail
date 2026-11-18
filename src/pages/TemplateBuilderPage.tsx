import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, FileWarning, Plus, Save, Trash2 } from 'lucide-react';
import { db, getTemplate } from '../db/db';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button, IconButton } from '../components/ui/Button';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { Chip } from '../components/ui/Chip';
import { EmptyState } from '../components/ui/EmptyState';
import { Switch } from '../components/ui/Switch';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { newId } from '../lib/id';
import type { FieldType, Template } from '../types';

const FIELD_TYPES: Array<{ value: FieldType; label: string }> = [
  { value: 'short', label: 'Short text' },
  { value: 'long', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'photo', label: 'Photos' },
];

const SUBJECT_TOKENS = [
  { token: '[Type]', label: '+ Report name' },
  { token: '[Site]', label: '+ Site name' },
  { token: '[Date]', label: '+ Date' },
];

export function TemplateBuilderPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [template, setTemplate] = useState<Template | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [newType, setNewType] = useState<FieldType>('short');
  const [saving, setSaving] = useState(false);

  const recipients = useLiveQuery(() => db.recipients.orderBy('name').toArray(), [], []);

  useEffect(() => {
    let alive = true;
    setNotFound(false);
    if (id) {
      void getTemplate(id).then((found) => {
        if (!alive) return;
        if (!found) {
          setNotFound(true);
          setTemplate(null);
        } else {
          setTemplate(structuredClone(found));
        }
      });
    } else {
      const now = Date.now();
      setTemplate({
        id: newId(),
        name: '',
        description: '',
        subjectPattern: '[Type] – [Site] – [Date]',
        fields: [],
        defaultRecipientIds: [],
        createdAt: now,
        updatedAt: now,
      });
    }
    return () => {
      alive = false;
    };
  }, [id]);

  if (notFound) {
    return (
      <div className="mx-auto w-full max-w-[1120px] px-4 pb-10 sm:px-6">
        <PageHeader title="Not found" backTo="/templates" sticky={false} />
        <EmptyState
          icon={<FileWarning aria-hidden className="size-5" />}
          title="Template not found"
          description="This template may have been deleted."
          action={
            <Link to="/templates">
              <Button variant="primary">Back to Templates</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="mx-auto w-full max-w-[1120px] px-4 pb-10 sm:px-6">
        <PageHeader title="Template" backTo="/templates" sticky={false} />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const patch = (changes: Partial<Template>) =>
    setTemplate((current) => (current ? { ...current, ...changes } : current));

  const addField = () => {
    const label = FIELD_TYPES.find((type) => type.value === newType)?.label ?? 'Field';
    setTemplate((current) =>
      current
        ? {
            ...current,
            fields: [
              ...current.fields,
              {
                id: newId(),
                type: newType,
                label: label === 'Photos' ? 'Photos' : `${label} field`,
                required: false,
                options:
                  newType === 'dropdown' || newType === 'checklist'
                    ? ['Option 1', 'Option 2']
                    : undefined,
              },
            ],
          }
        : current,
    );
  };

  const updateField = (fieldId: string, changes: Partial<Template['fields'][number]>) => {
    setTemplate((current) =>
      current
        ? {
            ...current,
            fields: current.fields.map((field) =>
              field.id === fieldId ? { ...field, ...changes } : field,
            ),
          }
        : current,
    );
  };

  const moveField = (index: number, direction: -1 | 1) => {
    setTemplate((current) => {
      if (!current) return current;
      const target = index + direction;
      if (target < 0 || target >= current.fields.length) return current;
      const fields = [...current.fields];
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...current, fields };
    });
  };

  const removeField = (fieldId: string) => {
    setTemplate((current) =>
      current
        ? { ...current, fields: current.fields.filter((field) => field.id !== fieldId) }
        : current,
    );
  };

  const save = async () => {
    if (!template.name.trim()) {
      toast.show({ message: 'Enter a template name.', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      await db.templates.put({ ...template, name: template.name.trim(), updatedAt: Date.now() });
      toast.show({ message: 'Template saved.', tone: 'success' });
      navigate('/templates');
    } catch {
      toast.show({ message: 'Could not save template.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pb-8 sm:px-6">
      <PageHeader
        title={id ? 'Edit template' : 'New template'}
        backTo="/templates"
        sticky={false}
      />

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Template details" />
          <CardBody className="flex flex-col gap-4 pt-3">
            <Field label="Template name" htmlFor="template-name" required>
              <Input
                id="template-name"
                value={template.name}
                onChange={(event) => patch({ name: event.target.value })}
                placeholder="Weekly Site Check"
              />
            </Field>
            <Field label="Short description (optional)" htmlFor="template-description">
              <Input
                id="template-description"
                value={template.description ?? ''}
                onChange={(event) => patch({ description: event.target.value })}
                placeholder="What is this report used for?"
              />
            </Field>
            <div>
              <Field
                label="Automatic email subject"
                htmlFor="template-subject"
              >
                <Input
                  id="template-subject"
                  value={template.subjectPattern}
                  onChange={(event) => patch({ subjectPattern: event.target.value })}
                />
              </Field>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-caption-1-regular text-muted">Insert:</span>
                {SUBJECT_TOKENS.map(({ token, label }) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() =>
                      patch({
                        subjectPattern: `${template.subjectPattern.trim()} ${token}`.trim(),
                      })
                    }
                    className="press cursor-pointer rounded-chip border border-line-strong bg-raised px-2.5 py-0.5 text-caption-1-semibold text-ink hover:bg-surface"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Usual recipients" description="Automatically selected when you send this report." />
          <CardBody className="pt-3">
            {recipients.length === 0 ? (
              <p className="text-body-2-regular text-muted">
                No recipients saved yet. You can add people in Settings or when sending a report.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recipients.map((recipient) => {
                  const selected = template.defaultRecipientIds.includes(recipient.id);
                  return (
                    <Chip
                      key={recipient.id}
                      selected={selected}
                      onClick={() =>
                        patch({
                          defaultRecipientIds: selected
                            ? template.defaultRecipientIds.filter((value) => value !== recipient.id)
                            : [...template.defaultRecipientIds, recipient.id],
                        })
                      }
                    >
                      {recipient.name || recipient.email}
                    </Chip>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <section aria-labelledby="fields-heading">
          <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
            <h2 id="fields-heading" className="text-body-semibold text-ink">
              Questions & fields
            </h2>
            <span className="text-body-2-regular text-muted">{template.fields.length} total</span>
          </div>

          {template.fields.length === 0 && (
            <p className="mb-3 rounded-card border border-dashed border-line-strong bg-surface/60 p-5 text-center text-body-2-regular text-muted">
              No fields added yet.
            </p>
          )}

          <ul className="flex flex-col gap-3">
            {template.fields.map((field, index) => (
              <li key={field.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-chip bg-accent-soft px-2.5 py-0.5 text-caption-1-semibold text-accent">
                      {FIELD_TYPES.find((type) => type.value === field.type)?.label}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <IconButton
                        label="Move field up"
                        size="sm"
                        disabled={index === 0}
                        onClick={() => moveField(index, -1)}
                      >
                        <ArrowUp aria-hidden className="size-4" />
                      </IconButton>
                      <IconButton
                        label="Move field down"
                        size="sm"
                        disabled={index === template.fields.length - 1}
                        onClick={() => moveField(index, 1)}
                      >
                        <ArrowDown aria-hidden className="size-4" />
                      </IconButton>
                      <IconButton
                        label="Remove field"
                        size="sm"
                        variant="danger"
                        onClick={() => removeField(field.id)}
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </IconButton>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Question / heading" htmlFor={`label-${field.id}`}>
                      <Input
                        id={`label-${field.id}`}
                        value={field.label}
                        onChange={(event) => updateField(field.id, { label: event.target.value })}
                      />
                    </Field>
                    <Field label="Answer type" htmlFor={`type-${field.id}`}>
                      <Select
                        id={`type-${field.id}`}
                        value={field.type}
                        onChange={(event) => {
                          const type = event.target.value as FieldType;
                          updateField(field.id, {
                            type,
                            options:
                              type === 'dropdown' || type === 'checklist'
                                ? field.options?.length
                                  ? field.options
                                  : ['Option 1', 'Option 2']
                                : undefined,
                          });
                        }}
                      >
                        {FIELD_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <div className="mt-3">
                    <Field label="Note under question (optional)" htmlFor={`help-${field.id}`}>
                      <Input
                        id={`help-${field.id}`}
                        value={field.help ?? ''}
                        onChange={(event) => updateField(field.id, { help: event.target.value })}
                      />
                    </Field>
                  </div>

                  {(field.type === 'dropdown' || field.type === 'checklist') && (
                    <div className="mt-3">
                      <Field label="Choices (one per line)" htmlFor={`options-${field.id}`}>
                        <Textarea
                          id={`options-${field.id}`}
                          rows={3}
                          value={(field.options ?? []).join('\n')}
                          onChange={(event) =>
                            updateField(field.id, {
                              options: event.target.value
                                .split('\n')
                                .map((line) => line.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      </Field>
                    </div>
                  )}

                  <div className="mt-3 border-t border-line pt-3">
                    <Switch
                      id={`required-${field.id}`}
                      checked={field.required}
                      onChange={(required) => updateField(field.id, { required })}
                      label="Must be filled in before sending"
                    />
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-col gap-2 rounded-card border border-line bg-surface p-3 sm:flex-row">
            <Select
              aria-label="New field type"
              value={newType}
              onChange={(event) => setNewType(event.target.value as FieldType)}
              className="sm:max-w-xs"
            >
              {FIELD_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              onClick={addField}
              iconLeft={<Plus aria-hidden className="size-4" />}
            >
              Add question
            </Button>
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-surface/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/templates')}>
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            loading={saving}
            onClick={() => void save()}
            iconLeft={<Save aria-hidden className="size-4" />}
          >
            Save template
          </Button>
        </div>
      </div>
    </div>
  );
}
