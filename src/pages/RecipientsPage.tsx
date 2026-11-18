import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AtSign, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { db } from '../db/db';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button, IconButton } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { Sheet } from '../components/ui/Sheet';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import { newId } from '../lib/id';
import { isValidEmail } from '../lib/validate';
import type { Recipient } from '../types';

export function RecipientsPage() {
  const toast = useToast();
  const recipients = useLiveQuery(() => db.recipients.orderBy('name').toArray(), [], null);
  const [editing, setEditing] = useState<Recipient | 'new' | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const open = (recipient: Recipient | 'new') => {
    setEditing(recipient);
    setName(recipient === 'new' ? '' : recipient.name);
    setEmail(recipient === 'new' ? '' : recipient.email);
    setLabel(recipient === 'new' ? '' : (recipient.label ?? ''));
    setError(null);
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    const recipient: Recipient = {
      id: editing && editing !== 'new' ? editing.id : newId(),
      name: name.trim(),
      email: cleanEmail,
      label: label.trim(),
      createdAt: editing && editing !== 'new' ? editing.createdAt : Date.now(),
    };

    void db.recipients.put(recipient).then(() => {
      setEditing(null);
      toast.show({ message: 'Recipient saved.', tone: 'success' });
    });
  };

  const remove = (recipient: Recipient) => {
    void db.recipients.delete(recipient.id).then(() =>
      toast.show({
        message: `${recipient.name || recipient.email} removed.`,
        action: { label: 'Undo', onClick: () => void db.recipients.put(recipient) },
      }),
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pb-10 sm:px-6">
      <PageHeader
        title="Recipients"
        backTo="/settings"
        sticky={false}
        actions={
          <Button
            variant="primary"
            onClick={() => open('new')}
            iconLeft={<Plus aria-hidden className="size-4" />}
          >
            Add recipient
          </Button>
        }
      />

      {recipients === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-14 rounded-card" />
          ))}
        </div>
      ) : recipients.length === 0 ? (
        <EmptyState
          icon={<UserRound aria-hidden className="size-5" />}
          title="No recipients saved"
          action={
            <Button variant="primary" onClick={() => open('new')}>
              Add recipient
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {recipients.map((recipient) => (
            <li key={recipient.id}>
              <Card className="flex items-center gap-3 p-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <AtSign aria-hidden className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-semibold text-ink">
                    {recipient.name || recipient.email}
                  </p>
                  <p className="truncate text-body-2-regular text-muted">
                    {recipient.label ? `${recipient.label} · ` : ''}
                    {recipient.email}
                  </p>
                </div>
                <IconButton
                  label={`Edit ${recipient.name || recipient.email}`}
                  size="sm"
                  onClick={() => open(recipient)}
                >
                  <Pencil aria-hidden className="size-4" />
                </IconButton>
                <IconButton
                  label={`Remove ${recipient.name || recipient.email}`}
                  size="sm"
                  variant="danger"
                  onClick={() => remove(recipient)}
                >
                  <Trash2 aria-hidden className="size-4" />
                </IconButton>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add recipient' : 'Edit recipient'}
        footer={
          <div className="flex gap-2 pb-1">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="recipient-form" variant="primary" fullWidth>
              Save
            </Button>
          </div>
        }
      >
        <form id="recipient-form" onSubmit={save} className="flex flex-col gap-4">
          <Field label="Name" htmlFor="recipient-name">
            <Input
              id="recipient-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Sarah Jones"
              autoComplete="name"
            />
          </Field>
          <Field
            label="Email address"
            htmlFor="recipient-email"
            required
            error={error ?? undefined}
          >
            <Input
              id="recipient-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
              placeholder="name@example.com"
              autoComplete="email"
              aria-invalid={!!error}
            />
          </Field>
          <Field label="Role / label (optional)" htmlFor="recipient-label">
            <Input
              id="recipient-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Supervisor"
            />
          </Field>
        </form>
      </Sheet>
    </div>
  );
}
