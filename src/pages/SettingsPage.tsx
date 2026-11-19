import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
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
import { cn } from '../lib/cn';
import type { LogoAlignment, ThemeMode } from '../types';

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
  const [appPassword, setAppPassword] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setMyName(settings.myName);
    setGmail(settings.gmail);
    setAppPassword(settings.accessKey);
    setSiteName(settings.defaultSiteName);
    setCompanyName(settings.branding.companyName);
  }, [settings]);

  const saveText = (field: 'myName' | 'gmail' | 'defaultSiteName', value: string) => {
    void update({ [field]: value.trim() });
  };

  const sendTest = async () => {
    const cleanEmail = gmail.trim();
    const cleanPass = appPassword.trim();
    if (!cleanEmail) {
      toast.show({ message: 'Enter your Gmail address first.', tone: 'error' });
      return;
    }
    if (!cleanPass) {
      toast.show({ message: 'Enter your 16-character Gmail App Password first.', tone: 'error' });
      return;
    }

    await update({ myName: myName.trim(), gmail: cleanEmail, accessKey: cleanPass });

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
        'Your Gmail account is connected. Reports you send from Fieldmail will be sent directly from your own email address with the printable PDF attached.',
        18,
        42,
        { maxWidth: 174 },
      );
      doc.text(`Sent from & to: ${cleanEmail}`, 18, 58);
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
        senderAppPassword: cleanPass,
        subject: 'Fieldmail test email',
        html: '<p>Your Gmail account is connected. Reports you send from Fieldmail will be sent directly from your own email address with the printable PDF attached.</p>',
        pdf: { filename: 'fieldmail-test-report.pdf', base64: base64FromBuffer(buffer) },
      });

      toast.show({ message: `Test email sent from ${cleanEmail}. Check your inbox.`, tone: 'success' });
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
              title="Your email account"
              description="Connect your Gmail so reports are sent directly from your own email address."
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
              <Field label="Your Gmail address" htmlFor="setting-gmail">
                <Input
                  id="setting-gmail"
                  type="email"
                  inputMode="email"
                  value={gmail}
                  onChange={(event) => setGmail(event.target.value)}
                  onBlur={() => saveText('gmail', gmail)}
                  autoComplete="email"
                  placeholder="you@gmail.com"
                />
              </Field>
              <div>
                <Field
                  label="Your Gmail App Password"
                  htmlFor="setting-key"
                  hint="A 16-letter code from Google that lets this app send emails from your Gmail. Stored only on your device."
                >
                  <div className="relative">
                    <Input
                      id="setting-key"
                      type={showKey ? 'text' : 'password'}
                      value={appPassword}
                      onChange={(event) => setAppPassword(event.target.value)}
                      onBlur={() => void update({ accessKey: appPassword.trim() })}
                      autoComplete="off"
                      spellCheck={false}
                      className="pe-10"
                      placeholder="xxxx xxxx xxxx xxxx"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((shown) => !shown)}
                      aria-label={showKey ? 'Hide app password' : 'Show app password'}
                      className="press absolute end-1 top-1 grid size-8 cursor-pointer place-items-center rounded-field text-muted hover:bg-raised"
                    >
                      {showKey ? (
                        <EyeOff aria-hidden className="size-4" />
                      ) : (
                        <Eye aria-hidden className="size-4" />
                      )}
                    </button>
                  </div>
                </Field>
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-caption-1-semibold text-accent hover:underline"
                >
                  Get your 16-letter App Password from Google
                  <ExternalLink aria-hidden className="size-3.5" />
                </a>
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
                  id="setting-copy"
                  checked={settings?.sendMeCopy ?? false}
                  onChange={(sendMeCopy) => void update({ sendMeCopy })}
                  label="Send a copy to my email"
                />
              </div>

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
