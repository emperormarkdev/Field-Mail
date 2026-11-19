import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ExternalLink, Mail, Plus, UserPlus, WifiOff } from 'lucide-react';
import type { Recipient, RecipientAssignment, Report, Settings } from '../types';
import { db, updateSettings } from '../db/db';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';
import { Field, Input } from './ui/Field';
import { Switch } from './ui/Switch';
import { useOnline } from '../hooks/useOnline';
import { buildSubject } from '../lib/email';
import { newId } from '../lib/id';
import { isValidEmail } from '../lib/validate';
import { cn } from '../lib/cn';

type Role = 'to' | 'cc' | 'bcc';
const ROLES: Role[] = ['to', 'cc', 'bcc'];

export function SendSheet({
  open,
  onClose,
  report,
  recipients,
  settings,
  sending,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  report: Report;
  recipients: Recipient[];
  settings: Settings;
  sending: boolean;
  onSend: (assignment: RecipientAssignment, subject: string, sendMeCopy: boolean) => void;
}) {
  const online = useOnline();
  const [assignment, setAssignment] = useState<RecipientAssignment>(() =>
    initialAssignment(report, recipients),
  );
  const [subject, setSubject] = useState(() => report.subject || buildSubject(report));
  const [sendMeCopy, setSendMeCopy] = useState(settings.sendMeCopy);
  const [error, setError] = useState<string | null>(null);

  const [senderGmail, setSenderGmail] = useState(settings.gmail);
  const [senderAppPass, setSenderAppPass] = useState(settings.accessKey);
  const needsSenderSetup = !settings.gmail.trim() || !settings.accessKey.trim();

  const [addingPerson, setAddingPerson] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAssignment(initialAssignment(report, recipients));
    setSubject(report.subject || buildSubject(report));
    setSendMeCopy(settings.sendMeCopy);
    setSenderGmail(settings.gmail);
    setSenderAppPass(settings.accessKey);
    setError(null);
    setAddingPerson(recipients.length === 0);
    setNewName('');
    setNewEmail('');
    setAddError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, report.id]);

  const selected = useMemo(
    () => assignment.to.length + assignment.cc.length + assignment.bcc.length,
    [assignment],
  );

  const roleOf = (id: string): Role | null => {
    for (const role of ROLES) if (assignment[role].includes(id)) return role;
    return null;
  };

  const toggle = (recipient: Recipient) => {
    const current = roleOf(recipient.id);
    const next: RecipientAssignment = {
      to: assignment.to.filter((id) => id !== recipient.id),
      cc: assignment.cc.filter((id) => id !== recipient.id),
      bcc: assignment.bcc.filter((id) => id !== recipient.id),
    };
    if (!current) next.to = [...next.to, recipient.id];
    setAssignment(next);
    setError(null);
  };

  const setRole = (recipient: Recipient, role: Role) => {
    const next: RecipientAssignment = {
      to: assignment.to.filter((id) => id !== recipient.id),
      cc: assignment.cc.filter((id) => id !== recipient.id),
      bcc: assignment.bcc.filter((id) => id !== recipient.id),
    };
    next[role] = [...next[role], recipient.id];
    setAssignment(next);
  };

  const handleQuickAdd = async (event: FormEvent) => {
    event.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setAddError('Enter a valid email address.');
      return;
    }
    const person: Recipient = {
      id: newId(),
      name: newName.trim(),
      email: cleanEmail,
      createdAt: Date.now(),
    };
    await db.recipients.put(person);
    setAssignment((current) => ({
      ...current,
      to: [...current.to, person.id],
    }));
    setNewName('');
    setNewEmail('');
    setAddError(null);
    setAddingPerson(false);
    setError(null);
  };

  const send = async () => {
    if (needsSenderSetup) {
      const cleanEmail = senderGmail.trim().toLowerCase();
      const cleanPass = senderAppPass.trim();
      if (!isValidEmail(cleanEmail)) {
        setError('Enter your Gmail address so the report can be sent from your email.');
        return;
      }
      if (!cleanPass) {
        setError('Enter your 16-letter Gmail App Password.');
        return;
      }
      await updateSettings({ gmail: cleanEmail, accessKey: cleanPass });
    }

    if (selected === 0) {
      setError('Select at least one person to receive this report.');
      return;
    }
    if (!subject.trim()) {
      setError('Enter an email subject.');
      return;
    }
    setError(null);
    onSend(assignment, subject.trim(), sendMeCopy);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Send report"
      description="Sends the written report as email text with the printable PDF attached."
      footer={
        <div className="flex flex-col gap-2">
          {!online && (
            <p className="flex items-start gap-2 rounded-field bg-warn-soft px-3 py-2 text-body-2-regular text-warn">
              <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
              No internet right now — your report will be saved and sent automatically when signal returns.
            </p>
          )}
          {error && (
            <p className="text-body-2-medium text-danger" role="alert">
              {error}
            </p>
          )}
          <Button variant="primary" size="lg" fullWidth onClick={() => void send()} loading={sending}>
            {online ? 'Send report now' : 'Save & send when online'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {needsSenderSetup && (
          <div className="flex flex-col gap-3 rounded-card border border-accent/35 bg-accent-soft p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-body-2-semibold text-ink">
                <Mail aria-hidden className="size-4 text-accent" />
                Send from your Gmail account (one-time setup)
              </span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Input
                type="email"
                inputMode="email"
                value={senderGmail}
                onChange={(event) => setSenderGmail(event.target.value)}
                placeholder="Your Gmail (you@gmail.com)"
                aria-label="Your Gmail address"
              />
              <Input
                type="password"
                value={senderAppPass}
                onChange={(event) => setSenderAppPass(event.target.value)}
                placeholder="16-letter Gmail App Password"
                aria-label="Your 16-letter Gmail App Password"
              />
            </div>
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-caption-1-semibold text-accent hover:underline"
            >
              Get your 16-letter App Password from Google
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </div>
        )}

        <Field label="Email subject" htmlFor="send-subject">
          <Input
            id="send-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </Field>

        <section aria-labelledby="send-recipients">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 id="send-recipients" className="text-body-medium text-ink">
              Send to ({selected} selected)
            </h3>
            {!addingPerson && (
              <button
                type="button"
                onClick={() => setAddingPerson(true)}
                className="press inline-flex cursor-pointer items-center gap-1 text-body-2-semibold text-accent hover:underline"
              >
                <Plus aria-hidden className="size-3.5" />
                Add person
              </button>
            )}
          </div>

          {addingPerson && (
            <form
              onSubmit={(event) => void handleQuickAdd(event)}
              className="mb-3 flex flex-col gap-3 rounded-card border border-line-strong bg-raised p-3"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-body-2-semibold text-ink">
                  <UserPlus aria-hidden className="size-4 text-accent" />
                  Add recipient
                </span>
                {recipients.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAddingPerson(false)}
                    className="text-caption-1-semibold text-muted hover:text-ink"
                  >
                    Close
                  </button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Name (optional)"
                  aria-label="Recipient name"
                />
                <Input
                  type="email"
                  inputMode="email"
                  value={newEmail}
                  onChange={(event) => {
                    setNewEmail(event.target.value);
                    setAddError(null);
                  }}
                  placeholder="email@company.com"
                  aria-label="Recipient email address"
                  required
                />
              </div>
              {addError && (
                <p className="text-body-2-medium text-danger" role="alert">
                  {addError}
                </p>
              )}
              <Button type="submit" variant="secondary" size="md">
                Save & select recipient
              </Button>
            </form>
          )}

          {recipients.length > 0 && (
            <ul className="flex flex-col gap-2">
              {recipients.map((recipient) => {
                const role = roleOf(recipient.id);
                return (
                  <li key={recipient.id} className="rounded-card border border-line bg-raised p-2">
                    <button
                      type="button"
                      onClick={() => toggle(recipient)}
                      aria-pressed={role !== null}
                      className="press flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-field px-1.5 text-start"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'grid size-5 shrink-0 place-items-center rounded-[0.25rem] border',
                          role
                            ? 'border-accent bg-accent text-on-accent'
                            : 'border-line-strong bg-surface',
                        )}
                      >
                        {role && (
                          <svg viewBox="0 0 16 16" className="size-3" fill="none">
                            <path
                              d="M3 8.5 6.5 12 13 4.5"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-semibold text-ink">
                          {recipient.name || recipient.email}
                        </span>
                        <span className="block truncate text-body-2-regular text-muted">
                          {recipient.label ? `${recipient.label} · ` : ''}
                          {recipient.email}
                        </span>
                      </span>
                    </button>
                    {role && (
                      <div className="mt-1.5 flex gap-1.5 border-t border-line pt-1.5">
                        {ROLES.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setRole(recipient, option)}
                            aria-pressed={role === option}
                            className={cn(
                              'press min-h-8 flex-1 cursor-pointer rounded-field text-caption-1-semibold uppercase',
                              role === option
                                ? 'bg-accent text-on-accent'
                                : 'bg-surface text-muted hover:bg-raised',
                            )}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="rounded-card border border-line bg-raised p-3.5">
          <Switch
            checked={sendMeCopy}
            onChange={setSendMeCopy}
            label="Send a copy to my email"
            description={senderGmail || settings.gmail || undefined}
            id="send-me-copy"
          />
        </div>
      </div>
    </Sheet>
  );
}

function initialAssignment(report: Report, recipients: Recipient[]): RecipientAssignment {
  const defaults = new Set(report.templateSnapshot.defaultRecipientIds);
  const saved = report.recipients;
  const hasSaved = saved.to.length + saved.cc.length + saved.bcc.length > 0;

  if (hasSaved) {
    const valid = (ids: string[]) => ids.filter((id) => recipients.some((r) => r.id === id));
    return { to: valid(saved.to), cc: valid(saved.cc), bcc: valid(saved.bcc) };
  }

  return {
    to: recipients.filter((r) => defaults.has(r.id)).map((r) => r.id),
    cc: [],
    bcc: [],
  };
}
