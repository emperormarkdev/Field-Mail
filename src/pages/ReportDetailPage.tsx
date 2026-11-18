import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertCircle,
  Check,
  Clock3,
  Copy,
  Download,
  FileText,
  FileWarning,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import { createReportDraft, db } from '../db/db';
import { useSettings } from '../hooks/useSettings';
import { useOutbox } from '../hooks/useOutbox';
import { useToast } from '../components/ui/Toast';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { Button, IconButton } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { downloadBlob } from '../lib/backup';
import { buildPdfBlob, pdfFilename } from '../lib/pdf';
import { blobUrl } from '../lib/photos';
import { flushQueue, requeueSentReport } from '../lib/queue';
import { formatDate, formatDateTime, plural, todayIso } from '../lib/format';
import type { Report, StoredPhoto } from '../types';

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { items, retryOne } = useOutbox();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const report = useLiveQuery<Report | null | undefined, undefined>(
    async () => {
      if (!id) return null;
      const found = await db.reports.get(id);
      return found ?? null;
    },
    [id],
    undefined,
  );
  const photos = useLiveQuery<StoredPhoto[], StoredPhoto[]>(
    () =>
      id
        ? (db.photos.where('reportId').equals(id).toArray() as Promise<StoredPhoto[]>)
        : Promise.resolve([] as StoredPhoto[]),
    [id],
    [] as StoredPhoto[],
  );

  const outboxItem = items.find((item) => item.reportId === id) ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!report || !settings) return;
    void buildPdfBlob({ report, photos, settings })
      .then((blob) => {
        if (cancelled) return;
        setPdfUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return URL.createObjectURL(blob);
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [report, photos, settings]);

  useEffect(
    () => () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    },
    [pdfUrl],
  );

  const download = useCallback(async () => {
    if (!report || !settings) return;
    setBusy(true);
    try {
      const blob = await buildPdfBlob({ report, photos, settings });
      downloadBlob(blob, pdfFilename(report));
    } catch {
      toast.show({ message: 'Could not generate PDF.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }, [report, settings, photos, toast]);

  const duplicateToNewDraft = useCallback(async () => {
    if (!report) return;
    const draft = createReportDraft({
      template: report.templateSnapshot,
      siteName: report.siteName,
      reportDate: todayIso(),
      values: structuredClone(report.values),
    });
    await db.reports.put(draft);
    toast.show({ message: 'Copied into a new draft for today.', tone: 'success' });
    navigate(`/reports/${draft.id}/edit`);
  }, [report, navigate, toast]);

  const remove = useCallback(async () => {
    if (!report) return;
    const saved = report;
    const savedOutbox = outboxItem;
    await db.reports.delete(saved.id);
    await db.outbox.where('reportId').equals(saved.id).delete();
    toast.show({
      message: 'Report deleted.',
      action: {
        label: 'Undo',
        onClick: () => {
          void db.reports.put(saved);
          if (savedOutbox) void db.outbox.put(savedOutbox);
        },
      },
    });
    navigate('/reports');
  }, [report, outboxItem, toast, navigate]);

  if (report === undefined) {
    return (
      <div className="mx-auto w-full max-w-[1120px] px-4 pb-10 sm:px-6">
        <PageHeader title="Report" backTo="/reports" sticky={false} />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (report === null) {
    return (
      <div className="mx-auto w-full max-w-[1120px] px-4 pb-10 sm:px-6">
        <PageHeader title="Not found" backTo="/reports" sticky={false} />
        <EmptyState
          icon={<FileWarning aria-hidden className="size-5" />}
          title="Report not found"
          description="This report may have been deleted."
          action={
            <Link to="/reports">
              <Button variant="primary">Back to Reports</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const waiting = report.status === 'queued' || report.status === 'sending';
  const failed = report.status === 'failed';

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pb-10 sm:px-6">
      <PageHeader
        title={report.templateName}
        description={`${report.siteName || 'No site'} · ${formatDate(report.reportDate)}`}
        backTo="/reports"
        sticky={false}
        actions={
          <IconButton label="Delete report" variant="danger" size="sm" onClick={() => void remove()}>
            <Trash2 aria-hidden className="size-4" />
          </IconButton>
        }
      />

      <Card>
        <CardHeader
          title="Delivery status"
          action={<StatusBadge status={report.status} />}
        />
        <CardBody className="pt-2">
          {report.status === 'sent' && (
            <p className="flex items-start gap-2 text-body-regular text-muted">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-ok" />
              Sent {report.sentAt ? formatDateTime(report.sentAt) : ''} as email text and printable PDF.
              {!!report.partCount && report.partCount > 1 &&
                ` Delivered across ${report.partCount} ${plural(report.partCount, 'email')}.`}
            </p>
          )}
          {waiting && (
            <p className="flex items-start gap-2 text-body-regular text-muted">
              <Clock3 aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
              {report.status === 'sending'
                ? 'Sending now…'
                : 'Waiting for internet connection — will send automatically.'}
            </p>
          )}
          {report.status === 'draft' && (
            <p className="flex items-start gap-2 text-body-regular text-muted">
              <Pencil aria-hidden className="mt-0.5 size-4 shrink-0" />
              Draft saved on this device.
            </p>
          )}
          {failed && (
            <div className="rounded-field border border-danger/30 bg-danger-soft p-3">
              <p className="flex items-start gap-2 text-body-medium text-danger">
                <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
                {report.lastError || 'Could not send this report.'}
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {report.status === 'draft' && (
              <Button
                variant="primary"
                onClick={() => navigate(`/reports/${report.id}/edit`)}
                iconLeft={<Pencil aria-hidden className="size-4" />}
              >
                Continue editing
              </Button>
            )}
            {failed && outboxItem && (
              <Button
                variant="primary"
                loading={busy}
                onClick={() => {
                  setBusy(true);
                  void retryOne(outboxItem.id).finally(() => setBusy(false));
                }}
                iconLeft={<RotateCcw aria-hidden className="size-4" />}
              >
                Try sending again
              </Button>
            )}
            {report.status === 'sent' && (
              <Button
                variant="primary"
                loading={busy}
                onClick={() => {
                  setBusy(true);
                  void requeueSentReport(report)
                    .then(() => flushQueue())
                    .then(() => toast.show({ message: 'Sending report again.', tone: 'success' }))
                    .finally(() => setBusy(false));
                }}
                iconLeft={<Send aria-hidden className="size-4" />}
              >
                Send again
              </Button>
            )}
            <Button
              variant="secondary"
              loading={busy}
              onClick={() => void download()}
              iconLeft={<Download aria-hidden className="size-4" />}
            >
              Download PDF
            </Button>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="press inline-flex min-h-10 items-center gap-2 rounded-field border border-line-strong bg-surface px-3.5 text-body-semibold text-ink shadow-2xs hover:bg-raised"
              >
                <FileText aria-hidden className="size-4" />
                Open PDF
              </a>
            )}
            <Button
              variant="secondary"
              onClick={() => void duplicateToNewDraft()}
              iconLeft={<Copy aria-hidden className="size-4" />}
            >
              Copy to new draft
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Written report" description={report.subject || undefined} />
        <CardBody className="pt-3">
          <dl className="flex flex-col gap-4">
            {report.templateSnapshot.fields.map((field) => {
              const raw = report.values[field.id];
              if (field.type === 'photo') return null;
              if (raw == null || (Array.isArray(raw) && !raw.length)) return null;
              const value = Array.isArray(raw) ? raw.join(', ') : String(raw);
              if (!value.trim()) return null;
              return (
                <div key={field.id} className="min-w-0 border-b border-line pb-3 last:border-b-0 last:pb-0">
                  <dt className="text-caption-1-semibold uppercase text-muted">
                    {field.label}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-body-regular text-ink">
                    {value}
                  </dd>
                </div>
              );
            })}
          </dl>

          {photos.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-caption-1-semibold uppercase text-muted">
                {photos.length} {plural(photos.length, 'photo')}
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {photos.map((photo) => (
                  <li key={photo.id} className="overflow-hidden rounded-field border border-line">
                    <img
                      src={blobUrl(photo.thumb)}
                      alt={photo.caption || 'Report photo'}
                      className="aspect-[4/3] w-full object-cover"
                      loading="lazy"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>

      <p className="mt-4 text-center text-caption-1-regular text-muted">
        Created {formatDateTime(report.createdAt)}
      </p>
    </div>
  );
}
