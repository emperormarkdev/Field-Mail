import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, Download, Eye, FileText, FileWarning, Info, Save, Send } from 'lucide-react';
import { db, createReportDraft, getTemplate } from '../db/db';
import { DEFAULT_SNIPPETS } from '../db/starters';
import { useSettings } from '../hooks/useSettings';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useToast } from '../components/ui/Toast';
import { PageHeader } from '../components/ui/PageHeader';
import { Field, Input } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Sheet } from '../components/ui/Sheet';
import { Skeleton } from '../components/ui/Skeleton';
import { FieldControl } from '../components/fields/ReportFields';
import { PhotoMarkupSheet } from '../components/PhotoMarkupSheet';
import { SendSheet } from '../components/SendSheet';
import { downloadBlob } from '../lib/backup';
import { createStoredPhoto } from '../lib/photos';
import { buildPdfBlob, pdfFilename } from '../lib/pdf';
import { enqueueReport, flushQueue } from '../lib/queue';
import { formatDate, formatDateTime, todayIso } from '../lib/format';
import { validateReport } from '../lib/validate';
import type { FieldValue, RecipientAssignment, Report, StoredPhoto } from '../types';
import { cn } from '../lib/cn';

export function ReportFormPage() {
  const { templateId, id } = useParams<{ templateId?: string; id?: string }>();
  const navigate = useNavigate();
  const { settings, update: updateSettings } = useSettings();
  const toast = useToast();
  const wide = useMediaQuery('(min-width: 1280px)');

  const [report, setReport] = useState<Report | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [savingState, setSavingState] = useState<'saved' | 'saving'>('saved');
  const reportRef = useRef<Report | null>(null);
  const initKeyRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<number | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sendOpen, setSendOpen] = useState(false);
  const [previewSheetOpen, setPreviewSheetOpen] = useState(false);
  const [markupPhoto, setMarkupPhoto] = useState<StoredPhoto | null>(null);
  const [sending, setSending] = useState(false);
  const [busyFieldId, setBusyFieldId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const recipients = useLiveQuery(() => db.recipients.orderBy('name').toArray(), [], []);
  const photos = useLiveQuery(
    () =>
      report
        ? db.photos.where('reportId').equals(report.id).toArray()
        : Promise.resolve([] as StoredPhoto[]),
    [report?.id],
    [] as StoredPhoto[],
  );

  const previousReport = useLiveQuery(
    async () => {
      if (!report) return null;
      const matches = await db.reports
        .where('templateId')
        .equals(report.templateId)
        .toArray();
      const others = matches
        .filter((item) => item.id !== report.id && Object.keys(item.values).length > 0)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      return others[0] ?? null;
    },
    [report?.id, report?.templateId],
    null,
  );

  const setCurrent = useCallback((next: Report | null) => {
    reportRef.current = next;
    setReport(next);
  }, []);

  const saveNow = useCallback(async () => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const current = reportRef.current;
    if (!current) return;
    const next = { ...current, updatedAt: Date.now() };
    setCurrent(next);
    await db.reports.put(next);
    dirtyRef.current = false;
    setSavingState('saved');
  }, [setCurrent]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setSavingState('saving');
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void saveNow();
    }, 1500);
  }, [saveNow]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setNotFound(false);
    void db.reports.get(id).then((found) => {
      if (!alive) return;
      if (!found) {
        setNotFound(true);
        setCurrent(null);
      } else {
        setCurrent(found);
      }
    });
    return () => {
      alive = false;
    };
  }, [id, setCurrent]);

  useEffect(() => {
    if (!templateId) return;
    const key = `new:${templateId}`;
    if (initKeyRef.current === key) return;
    initKeyRef.current = key;
    setNotFound(false);

    let alive = true;
    void getTemplate(templateId).then((template) => {
      if (!alive) return;
      if (!template) {
        setNotFound(true);
        return;
      }
      const values: Record<string, FieldValue> = {};
      for (const field of template.fields) {
        if (field.type === 'date') values[field.id] = todayIso();
      }
      const draft = createReportDraft({
        template,
        siteName: settings?.lastSiteName || settings?.defaultSiteName || '',
        reportDate: todayIso(),
        values,
      });
      void db.reports.put(draft);
      setCurrent(draft);
    });

    return () => {
      alive = false;
    };
  }, [templateId, settings, setCurrent]);

  useEffect(() => {
    if (!templateId || !settings) return;
    const current = reportRef.current;
    if (!current || current.siteName || dirtyRef.current) return;
    const defaultSite = settings.lastSiteName || settings.defaultSiteName;
    if (defaultSite) {
      const next = { ...current, siteName: defaultSite };
      setCurrent(next);
      void db.reports.put(next);
    }
  }, [templateId, settings, setCurrent]);

  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return;
      void saveNow();
    };
    const interval = window.setInterval(flush, 5000);
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
      if (dirtyRef.current) void saveNow();
    };
  }, [saveNow]);

  useEffect(() => {
    if ((!wide && !previewSheetOpen) || !report || !settings) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void buildPdfBlob({ report, photos, settings })
        .then((blob) => {
          if (cancelled) return;
          setPreviewUrl((previous) => {
            if (previous) URL.revokeObjectURL(previous);
            return URL.createObjectURL(blob);
          });
        })
        .catch(() => undefined);
    }, wide ? 700 : 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [wide, previewSheetOpen, report, photos, settings]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const patch = useCallback(
    (updater: (current: Report) => Report) => {
      const current = reportRef.current;
      if (!current || current.status !== 'draft') return;
      setCurrent(updater(current));
      scheduleSave();
    },
    [scheduleSave, setCurrent],
  );

  const copyFromPrevious = useCallback(() => {
    if (!previousReport) return;
    patch((current) => {
      const mergedValues: Record<string, FieldValue> = { ...current.values };
      for (const field of current.templateSnapshot.fields) {
        if (field.type === 'photo') continue;
        if (field.type === 'date') {
          mergedValues[field.id] = todayIso();
          continue;
        }
        const prevVal = previousReport.values[field.id];
        if (prevVal !== undefined && prevVal !== null && prevVal !== '') {
          mergedValues[field.id] = structuredClone(prevVal);
        }
      }
      return {
        ...current,
        siteName: current.siteName || previousReport.siteName,
        values: mergedValues,
      };
    });
    void saveNow();
    toast.show({
      message: `Copied details from ${formatDate(previousReport.reportDate)}.`,
      tone: 'success',
    });
  }, [previousReport, patch, saveNow, toast]);

  const downloadPreviewPdf = useCallback(async () => {
    if (!report || !settings) return;
    const blob = await buildPdfBlob({ report, photos, settings });
    downloadBlob(blob, pdfFilename(report));
  }, [report, photos, settings]);

  const setValue = useCallback(
    (fieldId: string, value: FieldValue) => {
      patch((current) => ({ ...current, values: { ...current.values, [fieldId]: value } }));
      if (errors[fieldId]) {
        setErrors((current) => {
          const next = { ...current };
          delete next[fieldId];
          return next;
        });
      }
    },
    [patch, errors],
  );

  const snippets = useMemo(
    () => settings?.snippets ?? DEFAULT_SNIPPETS,
    [settings?.snippets],
  );

  const handleAddSnippet = useCallback(
    (phrase: string) => {
      const next = Array.from(new Set([...snippets, phrase]));
      void updateSettings({ snippets: next });
    },
    [snippets, updateSettings],
  );

  const handleRemoveSnippet = useCallback(
    (phrase: string) => {
      const next = snippets.filter((item) => item !== phrase);
      void updateSettings({ snippets: next });
    },
    [snippets, updateSettings],
  );

  const addPhotos = useCallback(
    async (fieldId: string, files: File[]) => {
      const current = reportRef.current;
      if (!current) return;
      setBusyFieldId(fieldId);
      const shouldStamp = settings?.stampPhotos ?? true;
      const lowSignal = settings?.lowSignalMode ?? false;
      const stampText = shouldStamp
        ? [current.siteName.trim(), formatDateTime(Date.now())].filter(Boolean).join(' · ')
        : undefined;
      try {
        const stored: StoredPhoto[] = [];
        for (const file of files) {
          stored.push(
            await createStoredPhoto({
              file,
              reportId: current.id,
              fieldId,
              lowSignal,
              stampText,
            }),
          );
        }
        await db.photos.bulkAdd(stored);
        toast.show({
          message: `${stored.length} ${stored.length === 1 ? 'photo' : 'photos'} added${
            lowSignal ? ' (compact size)' : ''
          }.`,
          tone: 'success',
        });
        setErrors((previous) => {
          const next = { ...previous };
          delete next[fieldId];
          return next;
        });
      } catch (error) {
        toast.show({
          message: (error as Error).message || 'Photo could not be added.',
          tone: 'error',
        });
      } finally {
        setBusyFieldId(null);
      }
    },
    [toast, settings?.stampPhotos, settings?.lowSignalMode],
  );

  const removePhoto = useCallback(
    (photo: StoredPhoto) => {
      void db.photos.delete(photo.id);
      toast.show({
        message: 'Photo removed.',
        action: { label: 'Undo', onClick: () => void db.photos.put(photo) },
      });
    },
    [toast],
  );

  const savePhotoMarkup = useCallback(
    async (
      photoId: string,
      updated: { blob: Blob; thumb: Blob; width: number; height: number },
    ) => {
      await db.photos.update(photoId, updated);
      toast.show({ message: 'Photo markup saved.', tone: 'success' });
    },
    [toast],
  );

  const locked = !!report && report.status !== 'draft';

  const openSend = () => {
    const current = reportRef.current;
    if (!current) return;
    const validation = validateReport(current, photos);
    setErrors(validation.fieldErrors);
    if (!validation.valid) {
      toast.show({
        message: `Please fill in: ${validation.messages.slice(0, 3).join(', ')}.`,
        tone: 'error',
      });
      window.setTimeout(() => {
        const first = validation.messages[0];
        const field = current.templateSnapshot.fields.find((item) => item.label === first);
        document
          .getElementById(field ? `field-wrapper-${field.id}` : 'site-name')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
      return;
    }
    setSendOpen(true);
  };

  const handleSend = async (
    assignment: RecipientAssignment,
    subject: string,
    sendMeCopy: boolean,
  ) => {
    const current = reportRef.current;
    if (!current) return;
    setSending(true);
    try {
      await saveNow();
      const latest = reportRef.current ?? current;
      const lookup = (ids: string[]) =>
        ids
          .map((recipientId) => recipients.find((recipient) => recipient.id === recipientId)?.email)
          .filter((email): email is string => !!email);

      const finalAssignment: RecipientAssignment = {
        to: lookup(assignment.to),
        cc: lookup(assignment.cc),
        bcc: lookup(assignment.bcc),
      };
      if (sendMeCopy && settings?.gmail) {
        finalAssignment.bcc = Array.from(new Set([...finalAssignment.bcc, settings.gmail]));
      }

      await enqueueReport({ ...latest, subject }, finalAssignment);
      setSendOpen(false);

      const result = await flushQueue();
      if (result.sent > 0) {
        toast.show({ message: 'Report sent.', tone: 'success' });
      } else {
        toast.show({
          message: 'Saved — will send automatically when internet connects.',
        });
      }
      navigate(`/reports/${latest.id}`, { replace: true });
    } catch (error) {
      toast.show({
        message: (error as Error).message || 'Report saved, but sending failed.',
        tone: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  const fields = useMemo(() => report?.templateSnapshot.fields ?? [], [report]);

  if (notFound) {
    return (
      <div className="mx-auto w-full max-w-[1120px] px-4 pb-10 sm:px-6">
        <PageHeader title="Not found" backTo="/" />
        <EmptyState
          icon={<FileWarning aria-hidden className="size-5" />}
          title="Template or report not found"
          description="The requested template or draft does not exist on this device."
          action={
            <Link to="/">
              <Button variant="primary">Back to Home</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="mx-auto w-full max-w-[1120px] px-4 pb-10 sm:px-6">
        <PageHeader title="Loading report" backTo="/" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-2/5" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pb-6 sm:px-6">
      <PageHeader
        title={report.templateName}
        backTo={id ? `/reports/${id}` : '/'}
        actions={
          !wide ? (
            <Button
              variant="secondary"
              onClick={() => setPreviewSheetOpen(true)}
              iconLeft={<Eye aria-hidden className="size-4" />}
              className="px-2.5 sm:px-3.5"
            >
              <span className="hidden sm:inline">Preview PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          ) : undefined
        }
      />

      {!locked && previousReport && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-surface px-3.5 py-2.5 shadow-card">
          <p className="text-caption-1-regular text-muted sm:text-body-2-regular">
            Reuse details from your last report ({formatDate(previousReport.reportDate)})?
          </p>
          <Button
            variant="secondary"
            onClick={copyFromPrevious}
            iconLeft={<Copy aria-hidden className="size-3.5" />}
            className="min-h-8 px-2.5 text-caption-1-semibold"
          >
            Copy last report
          </Button>
        </div>
      )}

      {locked && (
        <div className="mb-3 flex items-start gap-2.5 rounded-card border border-accent/30 bg-accent-soft p-3 text-body-2-medium text-accent">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>This report has already been sent or is waiting to send, so editing is locked.</p>
        </div>
      )}

      {Object.keys(errors).length > 0 && (
        <div className="mb-3 flex items-start gap-2.5 rounded-card border border-danger/30 bg-danger-soft p-3 text-body-2-medium text-danger">
          <FileWarning aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            Please fill in the {Object.keys(errors).length} highlighted{' '}
            {Object.keys(errors).length === 1 ? 'field' : 'fields'} before sending.
          </p>
        </div>
      )}

      <div className={cn(wide && 'grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-6 items-start')}>
        <div className="min-w-0">
          <div className="rounded-card border border-line bg-surface shadow-card divide-y divide-line">
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <div id="site-name" className="scroll-mt-24">
                <Field
                  label="Site name"
                  htmlFor="report-site"
                  required
                  error={errors.siteName}
                >
                  <Input
                    id="report-site"
                    value={report.siteName}
                    disabled={locked}
                    list="site-suggestions"
                    onChange={(event) =>
                      patch((current) => ({ ...current, siteName: event.target.value }))
                    }
                    onBlur={() => {
                      void saveNow();
                      const site = reportRef.current?.siteName?.trim();
                      if (site) void updateSettings({ lastSiteName: site });
                    }}
                    placeholder="Site or project name"
                  />
                  <datalist id="site-suggestions">
                    {[settings?.lastSiteName, settings?.defaultSiteName]
                      .filter((value): value is string => !!value)
                      .map((value, index) => (
                        <option key={`${value}-${index}`} value={value} />
                      ))}
                  </datalist>
                </Field>
              </div>
              <Field label="Report date" htmlFor="report-date" required>
                <Input
                  id="report-date"
                  type="date"
                  value={report.reportDate}
                  disabled={locked}
                  onChange={(event) =>
                    patch((current) => ({ ...current, reportDate: event.target.value }))
                  }
                  onBlur={() => void saveNow()}
                />
              </Field>
            </div>

            {fields.map((field) => (
              <div
                key={field.id}
                id={`field-wrapper-${field.id}`}
                className="scroll-mt-24 p-4 sm:p-5"
              >
                <FieldControl
                  field={field}
                  value={report.values[field.id] ?? null}
                  error={errors[field.id]}
                  photos={photos.filter((photo) => photo.fieldId === field.id)}
                  busyFieldId={busyFieldId}
                  snippets={snippets}
                  onAddSnippet={handleAddSnippet}
                  onRemoveSnippet={handleRemoveSnippet}
                  onValueChange={setValue}
                  onBlur={() => void saveNow()}
                  onAddPhotos={(fieldId, files) => void addPhotos(fieldId, files)}
                  onRemovePhoto={removePhoto}
                  onMarkupPhoto={locked ? undefined : (photo) => setMarkupPhoto(photo)}
                  onCaptionChange={(photo, caption) =>
                    void db.photos.update(photo.id, { caption })
                  }
                />
              </div>
            ))}

            {fields.length === 0 && (
              <p className="p-6 text-center text-body-2-regular text-muted">
                This template has no fields yet.
              </p>
            )}
          </div>

          <div className="sticky bottom-0 z-20 -mx-4 mt-5 border-t border-line bg-surface/95 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-6 sm:px-6">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  void saveNow().then(() =>
                    toast.show({ message: 'Draft saved.', tone: 'success' }),
                  );
                }}
                iconLeft={<Save aria-hidden className="size-4" />}
                disabled={locked}
              >
                {savingState === 'saving' ? 'Saving…' : 'Save draft'}
              </Button>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={openSend}
                disabled={locked}
                iconRight={<Send aria-hidden className="size-4" />}
              >
                Send report
              </Button>
            </div>
          </div>
        </div>

        {wide && (
          <aside className="sticky top-4 min-w-0" aria-label="PDF preview">
            <div className="rounded-card border border-line bg-surface p-3 shadow-card">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <p className="text-body-2-semibold text-ink">Printable PDF preview</p>
                <button
                  type="button"
                  onClick={() => void downloadPreviewPdf()}
                  className="press inline-flex cursor-pointer items-center gap-1 text-caption-1-semibold text-accent hover:underline"
                >
                  <Download aria-hidden className="size-3.5" />
                  Download
                </button>
              </div>
              {previewUrl ? (
                <iframe
                  title="Report PDF preview"
                  src={previewUrl}
                  className="h-[calc(100dvh-7rem)] min-h-[32rem] w-full rounded-field border border-line bg-white"
                />
              ) : (
                <div className="flex h-[calc(100dvh-7rem)] min-h-[32rem] flex-col items-center justify-center gap-2 rounded-field border border-line bg-raised text-muted">
                  <FileText aria-hidden className="size-5" />
                  <p className="text-body-2-regular">Preparing printable PDF…</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <PhotoMarkupSheet
        photo={markupPhoto}
        siteName={report.siteName}
        stampLabel={formatDateTime(markupPhoto?.createdAt ?? Date.now())}
        lowSignal={settings?.lowSignalMode ?? false}
        onClose={() => setMarkupPhoto(null)}
        onSave={savePhotoMarkup}
      />

      <Sheet
        open={previewSheetOpen}
        onClose={() => setPreviewSheetOpen(false)}
        title="Printable PDF preview"
        size="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPreviewSheetOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={() => void downloadPreviewPdf()}
              iconLeft={<Download aria-hidden className="size-4" />}
            >
              Download PDF
            </Button>
          </div>
        }
      >
        {previewUrl ? (
          <iframe
            title="Report PDF preview"
            src={previewUrl}
            className="h-[68dvh] w-full rounded-field border border-line bg-white"
          />
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-field border border-line bg-raised text-muted">
            <FileText aria-hidden className="size-5" />
            <p className="text-body-2-regular">Preparing printable PDF…</p>
          </div>
        )}
      </Sheet>

      {settings && (
        <SendSheet
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          report={report}
          recipients={recipients}
          settings={settings}
          sending={sending}
          onSend={(assignment, subject, copy) => void handleSend(assignment, subject, copy)}
        />
      )}
    </div>
  );
}
