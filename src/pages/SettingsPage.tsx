import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Download,
  Monitor,
  Moon,
  Send,
  Sun,
  Upload,
} from 'lucide-react';
import { useRuntime } from '../app/AppRuntime';
import { useSettings } from '../hooks/useSettings';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { Switch } from '../components/ui/Switch';
import { useToast } from '../components/ui/Toast';
import { exportBackup, downloadBlob, importBackup } from '../lib/backup';
import { postPart, SendError } from '../lib/api';
import { base64FromBuffer } from '../lib/photos';
import {
  EMAIL_PROVIDERS,
  getProviderPreset,
  inferProviderFromEmail,
  resolveSmtpConfig,
} from '../lib/emailProviders';
import { cn } from '../lib/cn';
import type { EmailProvider, LogoAlignment, ThemeMode } from '../types';

const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string; icon: typeof Sun }> = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'system', label: 'Auto', icon: Monitor },
];

const LOGO_ALIGN_OPTIONS: Array<{ value: LogoAlignment; label: string; icon: typeof AlignLeft }> = [
  { value: 'left', label: 'Left', icon: AlignLeft },
  { value: 'center', label: 'Middle', icon: AlignCenter },
  { value: 'right', label: 'Right', icon: AlignRight },
];

export function SettingsPage() {
  const { settings, update } = useSettings();
  const { isIos, isStandalone, promptInstall, installPrompt } = useRuntime();
  const toast = useToast();
  const recipients = useLiveQuery(() => db.recipients.toArray(), [], []);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const [myName, setMyName] = useState('');
  const [gmail, setGmail] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [emailProvider, setEmailProvider] = useState<EmailProvider>('auto');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState<number>(465);
  const [showAdvancedMail, setShowAdvancedMail] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setMyName(settings.myName);
    setGmail(settings.gmail);
    setAccessKey(settings.accessKey);
    const savedProvider = settings.emailProvider ?? 'auto';
    setEmailProvider(savedProvider);
    setSmtpHost(settings.smtpHost ?? '');
    setSmtpPort(settings.smtpPort ?? 465);
    if (savedProvider !== 'auto') setShowAdvancedMail(true);
    setSiteName(settings.defaultSiteName);
    setCompanyName(settings.branding.companyName);
  }, [settings]);

  const saveText = (field: 'myName' | 'gmail' | 'accessKey' | 'smtpHost' | 'defaultSiteName', value: string) => {
    void update({ [field]: value.trim() });
  };

  const handleEmailBlur = () => {
    void update({ gmail: gmail.trim() });
  };

  const selectProvider = (next: EmailProvider) => {
    setEmailProvider(next);
    void update({ emailProvider: next });
  };

  const displayPreset = getProviderPreset(
    emailProvider === 'auto' ? (inferProviderFromEmail(gmail) ?? 'auto') : emailProvider,
  );

  const sendTest = async () => {
    const cleanEmail = gmail.trim();
    const cleanKey = accessKey.trim();
    const { smtpHost: resolvedHost, smtpPort: resolvedPort } = resolveSmtpConfig({
      emailProvider,
      smtpHost,
      smtpPort,
    });

    if (!cleanEmail) {
      toast.show({ message: 'Enter your email address first.', tone: 'error' });
      return;
    }
    if (!cleanKey) {
      toast.show({ message: `Enter your ${displayPreset.passwordLabel} first.`, tone: 'error' });
      return;
    }
    if (emailProvider === 'custom' && !resolvedHost) {
      toast.show({ message: 'Enter your SMTP server hostname first (e.g. mail.yourdomain.com).', tone: 'error' });
      return;
    }

    await update({
      myName: myName.trim(),
      gmail: cleanEmail,
      accessKey: cleanKey,
      emailProvider,
      smtpHost: smtpHost.trim(),
      smtpPort,
    });

    setTesting(true);
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('TEST REPORT', 18, 26);
      doc.setLineWidth(0.5);
      doc.line(18, 30, 192, 30);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.text(
        'Your email is ready. Reports you send from Fieldmail will arrive with the full written text in the email body and a printable PDF attached.',
        18,
        42,
        { maxWidth: 174 },
      );
      doc.text(`Sent to: ${cleanEmail}`, 18, 58);
      const buffer = doc.output('arraybuffer');

      await postPart({
        reportId: `test-${Date.now()}`,
        attemptId: `test-${Date.now()}`,
        partIndex: 0,
        partCount: 1,
        to: [cleanEmail],
        cc: [],
        bcc: [],
        senderName: myName.trim() || undefined,
        senderEmail: cleanEmail,
        senderAppPassword: cleanKey,
        smtpHost: resolvedHost || undefined,
        smtpPort: resolvedPort,
        subject: 'Fieldmail test email',
        html: '<p>Your email is ready. Reports you send from Fieldmail will arrive with the full written text in the email body and a printable PDF attached.</p>',
        pdf: { filename: 'fieldmail-test-report.pdf', base64: base64FromBuffer(buffer) },
      });

      toast.show({ message: `Test email sent from ${cleanEmail}. Check your Sent folder.`, tone: 'success' });
    } catch (error) {
      const message =
        error instanceof SendError ? error.message : 'Could not send test email.';
      toast.show({ message, tone: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const chooseLogo = (event: ChangeEvent<HTMLInputElement>) => {
    if (!settings) return;
    const currentBranding = settings.branding;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 600 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        void update({
          branding: { ...currentBranding, logoDataUrl: canvas.toDataURL('image/jpeg', 0.85) },
        });
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const setLogoAlign = (logoAlign: LogoAlignment) => {
    if (!settings) return;
    void update({
      branding: { ...settings.branding, logoAlign },
    });
  };

  const doExport = async () => {
    const blob = await exportBackup();
    downloadBlob(blob, `fieldmail-backup-${new Date().toISOString().slice(0, 10)}.json`);
    toast.show({ message: 'Backup file saved.', tone: 'success' });
  };

  const doImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const result = await importBackup(file);
      toast.show({
        message: `Restored ${result.reports} reports and ${result.templates} templates.`,
        tone: 'success',
      });
    } catch (error) {
      toast.show({ message: (error as Error).message, tone: 'error' });
    }
  };

  const currentTheme = settings?.theme ?? 'light';
  const currentLogoAlign: LogoAlignment = settings?.branding.logoAlign ?? 'left';

  return (
    <div className="mx-auto w-full max-w-[1120px] overflow-x-hidden px-4 pb-10 sm:px-6">
      <PageHeader title="Settings" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader
              title="Your details & email"
              description="Works with Gmail, Outlook, Yahoo, Zoho, Proton, or company domain emails. Your mail server is detected automatically."
            />
            <CardBody className="flex flex-col gap-4 pt-3">
              <Field label="Your name" htmlFor="setting-name">
                <Input
                  id="setting-name"
                  value={myName}
                  onChange={(event) => setMyName(event.target.value)}
                  onBlur={() => saveText('myName', myName)}
                  autoComplete="name"
                  placeholder="Your full name"
                />
              </Field>
              <Field label="Your email address" htmlFor="setting-gmail">
                <Input
                  id="setting-gmail"
                  type="email"
                  inputMode="email"
                  value={gmail}
                  onChange={(event) => setGmail(event.target.value)}
                  onBlur={handleEmailBlur}
                  autoComplete="email"
                  placeholder="you@company.com"
                />
              </Field>

              <Field label={displayPreset.passwordLabel} htmlFor="setting-app-password">
                <Input
                  id="setting-app-password"
                  type="password"
                  value={accessKey}
                  onChange={(event) => setAccessKey(event.target.value)}
                  onBlur={() => saveText('accessKey', accessKey)}
                  autoComplete="off"
                  placeholder={displayPreset.passwordPlaceholder}
                />
                <p className="mt-1.5 text-caption-1-regular text-muted">
                  Saved only on this device.
                  {displayPreset.helpUrl && displayPreset.helpLabel ? (
                    <>
                      {' '}
                      <a
                        href={displayPreset.helpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-accent underline underline-offset-2"
                      >
                        {displayPreset.helpLabel}
                      </a>
                    </>
                  ) : (
                    ' Mail server & port are detected automatically from your email address.'
                  )}
                </p>
              </Field>

              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedMail((v) => !v)}
                  className="cursor-pointer text-caption-1-semibold text-muted underline underline-offset-2 hover:text-ink"
                >
                  {showAdvancedMail ? 'Hide manual server settings' : 'Advanced: manual server settings (optional)'}
                </button>

                {showAdvancedMail && (
                  <div className="mt-3 flex flex-col gap-3 rounded-field border border-line bg-raised p-3">
                    <div>
                      <p className="mb-1.5 text-body-2-medium text-ink">Email provider</p>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="group" aria-label="Email provider">
                        {EMAIL_PROVIDERS.map((provider) => {
                          const active = emailProvider === provider.id;
                          return (
                            <button
                              key={provider.id}
                              type="button"
                              onClick={() => selectProvider(provider.id)}
                              aria-pressed={active}
                              className={cn(
                                'press flex min-h-9 cursor-pointer items-center justify-center rounded-field border px-2 text-center text-caption-1-semibold',
                                active
                                  ? 'border-accent/45 bg-accent-soft text-accent'
                                  : 'border-line-strong bg-surface text-muted hover:bg-raised hover:text-ink',
                              )}
                            >
                              {provider.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {emailProvider === 'custom' && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <Field label="SMTP server" htmlFor="setting-smtp-host">
                            <Input
                              id="setting-smtp-host"
                              value={smtpHost}
                              onChange={(event) => setSmtpHost(event.target.value)}
                              onBlur={() => saveText('smtpHost', smtpHost)}
                              placeholder="mail.yourdomain.com"
                            />
                          </Field>
                        </div>
                        <Field label="Port" htmlFor="setting-smtp-port">
                          <select
                            id="setting-smtp-port"
                            value={smtpPort}
                            onChange={(event) => {
                              const port = Number(event.target.value);
                              setSmtpPort(port);
                              void update({ smtpPort: port });
                            }}
                            className="min-h-11 w-full rounded-field border border-line-strong bg-surface px-3 text-body-regular text-ink outline-none focus:border-accent"
                          >
                            <option value={465}>465 (SSL)</option>
                            <option value={587}>587 (TLS)</option>
                            <option value={2525}>2525 (TLS)</option>
                          </select>
                        </Field>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Field label="Usual site name" htmlFor="setting-site">
                <Input
                  id="setting-site"
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                  onBlur={() => saveText('defaultSiteName', siteName)}
                  list="site-settings-suggestions"
                  placeholder="Northgate Substation"
                />
                <datalist id="site-settings-suggestions">
                  {settings?.lastSiteName && <option value={settings.lastSiteName} />}
                </datalist>
              </Field>

              <Button
                variant="secondary"
                loading={testing}
                onClick={() => void sendTest()}
                iconLeft={<Send aria-hidden className="size-4" />}
              >
                Send test email to myself
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Reports & photos" />
            <CardBody className="flex flex-col gap-3 pt-3">
              <div className="rounded-field border border-line bg-raised p-3">
                <Switch
                  id="setting-low-signal"
                  checked={settings?.lowSignalMode ?? false}
                  onChange={(lowSignalMode) => void update({ lowSignalMode })}
                  label="Low-signal compact mode"
                  description="Shrinks photo sizes further so multi-photo reports send reliably over weak 2G/3G signal."
                />
              </div>

              <div className="rounded-field border border-line bg-raised p-3">
                <Switch
                  id="setting-stamp-photos"
                  checked={settings?.stampPhotos ?? true}
                  onChange={(stampPhotos) => void update({ stampPhotos })}
                  label="Stamp date & site on photos"
                  description="Automatically stamps the site name, date, and time in the corner of newly added photos."
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Appearance" />
            <CardBody className="pt-3">
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Color theme">
                {THEME_OPTIONS.map(({ mode, label, icon: Icon }) => {
                  const active = currentTheme === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => void update({ theme: mode })}
                      aria-pressed={active}
                      className={cn(
                        'press flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-field border text-body-semibold',
                        active
                          ? 'border-accent/45 bg-accent-soft text-accent'
                          : 'border-line-strong bg-surface text-muted hover:bg-raised hover:text-ink',
                      )}
                    >
                      <Icon aria-hidden className="size-4" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title="Company header & logo" description="Shown at the top of your PDF reports." />
            <CardBody className="flex flex-col gap-4 pt-3">
              <Field label="Company name" htmlFor="setting-company">
                <Input
                  id="setting-company"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  onBlur={() => {
                    if (!settings) return;
                    void update({
                      branding: { ...settings.branding, companyName: companyName.trim() },
                    });
                  }}
                  placeholder="Company name (optional)"
                />
              </Field>

              <div>
                <p className="mb-1.5 text-body-medium text-ink">Logo position on paper</p>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Logo position on paper">
                  {LOGO_ALIGN_OPTIONS.map(({ value, label, icon: Icon }) => {
                    const active = currentLogoAlign === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setLogoAlign(value)}
                        aria-pressed={active}
                        className={cn(
                          'press flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-field border text-body-semibold',
                          active
                            ? 'border-accent/45 bg-accent-soft text-accent'
                            : 'border-line-strong bg-surface text-muted hover:bg-raised hover:text-ink',
                        )}
                      >
                        <Icon aria-hidden className="size-4" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-field border border-line bg-white p-3.5 text-black">
                <p className="mb-2 text-caption-1-medium text-neutral-500">Paper header preview</p>
                <div className="border-b-2 border-black pb-2.5">
                  {currentLogoAlign === 'right' ? (
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {companyName.trim() && (
                          <p className="text-caption-1-bold uppercase text-neutral-700">
                            {companyName.trim()}
                          </p>
                        )}
                        <p className="text-body-bold uppercase text-black">DAILY SITE REPORT</p>
                      </div>
                      {settings?.branding.logoDataUrl ? (
                        <img
                          src={settings.branding.logoDataUrl}
                          alt="Company logo"
                          className="h-10 w-auto max-w-[7rem] object-contain"
                        />
                      ) : (
                        <span className="rounded border border-dashed border-neutral-400 px-2 py-1 text-caption-2-medium text-neutral-500">
                          LOGO
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'flex flex-col gap-1',
                        currentLogoAlign === 'center' ? 'items-center text-center' : 'items-start text-start',
                      )}
                    >
                      {settings?.branding.logoDataUrl ? (
                        <img
                          src={settings.branding.logoDataUrl}
                          alt="Company logo"
                          className="h-10 w-auto max-w-[7rem] object-contain"
                        />
                      ) : (
                        <span className="rounded border border-dashed border-neutral-400 px-2 py-1 text-caption-2-medium text-neutral-500">
                          LOGO
                        </span>
                      )}
                      {companyName.trim() && (
                        <p className="text-caption-1-bold uppercase text-neutral-700">
                          {companyName.trim()}
                        </p>
                      )}
                      <p className="text-body-bold uppercase text-black">DAILY SITE REPORT</p>
                    </div>
                  )}
                </div>
              </div>

              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={chooseLogo}
                aria-label="Choose a logo"
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => logoRef.current?.click()}>
                  {settings?.branding.logoDataUrl ? 'Change logo' : 'Upload logo'}
                </Button>
                {settings?.branding.logoDataUrl && (
                  <Button
                    variant="danger"
                    onClick={() =>
                      void update({ branding: { ...settings.branding, logoDataUrl: null } })
                    }
                  >
                    Remove logo
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Recipients"
              description={`${recipients.length} saved`}
            />
            <CardBody className="pt-3">
              {recipients.length > 0 && (
                <ul className="mb-3 flex flex-col divide-y divide-line">
                  {recipients.slice(0, 4).map((recipient) => (
                    <li key={recipient.id} className="flex items-center justify-between gap-2 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-body-medium text-ink">
                          {recipient.name || recipient.email}
                        </span>
                        <span className="block truncate text-caption-1-regular text-muted">
                          {recipient.label ? `${recipient.label} · ` : ''}
                          {recipient.email}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                to="/settings/recipients"
                className="press inline-flex min-h-10 w-full items-center justify-center rounded-field border border-line-strong bg-surface px-3.5 text-body-semibold text-ink shadow-2xs hover:bg-raised"
              >
                Manage recipients
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Backup & restore" />
            <CardBody className="flex flex-col gap-3 pt-3">
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => void doImport(event)}
                aria-label="Choose a backup file"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => void doExport()}
                  iconLeft={<Download aria-hidden className="size-4" />}
                >
                  Save backup file
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => fileRef.current?.click()}
                  iconLeft={<Upload aria-hidden className="size-4" />}
                >
                  Restore from file
                </Button>
              </div>
            </CardBody>
          </Card>

          {!isStandalone && (installPrompt || isIos) && (
            <Card>
              <CardHeader title="Install on home screen" />
              <CardBody className="pt-3">
                <Button variant="primary" onClick={() => void promptInstall()}>
                  {isIos && !installPrompt ? 'How to install' : 'Install app'}
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
