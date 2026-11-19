import { db, getSettings } from '../db/db';
import { buildParts, buildSubject } from './email';
import { postPart, SendError } from './api';
import { newId } from './id';
import type { OutboxItem, RecipientAssignment, Report } from '../types';

/** 30s, 2m, 8m, 30m, 2h, then hold at 2h. */
const BACKOFF_MS = [30_000, 120_000, 480_000, 1_800_000, 7_200_000];
const NEVER = Number.MAX_SAFE_INTEGER;

export function backoffFor(attempts: number): number {
  const index = Math.min(Math.max(attempts, 1) - 1, BACKOFF_MS.length - 1);
  return BACKOFF_MS[index];
}

export interface FlushSummary {
  attempted: number;
  sent: number;
  failed: number;
  blocked?: 'offline' | 'no-key' | 'nothing-to-do';
}

let inflight: Promise<FlushSummary> | null = null;

/** Single-flight: every trigger shares one run so a report can't be sent twice. */
export function flushQueue(): Promise<FlushSummary> {
  if (inflight) return inflight;
  inflight = runFlush().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function runFlush(): Promise<FlushSummary> {
  if (!navigator.onLine) {
    return { attempted: 0, sent: 0, failed: 0, blocked: 'offline' };
  }

  const settings = await getSettings();

  const now = Date.now();
  const items = (await db.outbox.toArray())
    .filter((item) => item.status !== 'sent' && item.nextAttemptAt <= now)
    .sort((a, b) => a.createdAt - b.createdAt);

  if (items.length === 0) return { attempted: 0, sent: 0, failed: 0, blocked: 'nothing-to-do' };

  let sent = 0;
  let failed = 0;

  for (const item of items) {
    if (!navigator.onLine) break;
    const ok = await sendItem(item, settings.accessKey);
    if (ok) sent++;
    else failed++;
  }

  return { attempted: sent + failed, sent, failed };
}

async function sendItem(item: OutboxItem, accessKey: string): Promise<boolean> {
  const report = await db.reports.get(item.reportId);
  if (!report) {
    // The report was deleted while queued; drop the orphan rather than fail forever.
    await db.outbox.delete(item.id);
    return false;
  }

  await db.outbox.update(item.id, {
    status: 'sending',
    updatedAt: Date.now(),
  });
  await db.reports.update(report.id, { status: 'sending', updatedAt: Date.now() });

  try {
    const settings = await getSettings();
    const photos = await db.photos.where('reportId').equals(report.id).toArray();
    photos.sort((a, b) => a.createdAt - b.createdAt);

    const parts = await buildParts({
      report,
      photos,
      settings,
      attemptId: item.id,
    });

    // Skip anything a previous attempt already got through.
    const remaining = parts.filter((part) => !item.sentParts.includes(part.partIndex));

    for (const part of remaining) {
      await postPart(part, accessKey);
      const fresh = await db.outbox.get(item.id);
      const sentParts = Array.from(new Set([...(fresh?.sentParts ?? item.sentParts), part.partIndex]));
      await db.outbox.update(item.id, { sentParts, updatedAt: Date.now() });
    }

    await db.reports.update(report.id, {
      status: 'sent',
      sentAt: Date.now(),
      updatedAt: Date.now(),
      partCount: parts.length,
      lastError: null,
    });
    await db.outbox.delete(item.id);
    return true;
  } catch (error) {
    const sendError =
      error instanceof SendError
        ? error
        : new SendError((error as Error)?.message || 'Something went wrong while sending.', {
            code: 'unknown',
            status: 0,
            retryable: true,
          });

    const attempts = item.attempts + 1;
    await db.outbox.update(item.id, {
      status: 'failed',
      attempts,
      nextAttemptAt: sendError.retryable ? Date.now() + backoffFor(attempts) : NEVER,
      lastError: sendError.message,
      updatedAt: Date.now(),
    });
    await db.reports.update(report.id, {
      status: 'failed',
      updatedAt: Date.now(),
      lastError: sendError.message,
    });
    return false;
  }
}

/** Queues a report and tries to send it straight away. */
export async function enqueueReport(
  report: Report,
  recipients: RecipientAssignment,
): Promise<{ outboxId: string }> {
  const now = Date.now();
  const outboxId = newId();
  const subject = report.subject?.trim() || buildSubject(report);

  await db.reports.update(report.id, {
    status: 'queued',
    recipients,
    subject,
    updatedAt: now,
    lastError: null,
  });

  await db.outbox.add({
    id: outboxId,
    reportId: report.id,
    status: 'queued',
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
    sentParts: [],
    createdAt: now,
    updatedAt: now,
  });

  return { outboxId };
}

export async function retryOutboxItem(outboxId: string): Promise<void> {
  const item = await db.outbox.get(outboxId);
  if (!item) return;
  await db.outbox.update(outboxId, {
    status: 'queued',
    nextAttemptAt: 0,
    lastError: null,
    updatedAt: Date.now(),
  });
  await db.reports.update(item.reportId, { status: 'queued', lastError: null });
}

/** Re-queues a report that has already been sent. A fresh attempt id allows the resend. */
export async function requeueSentReport(report: Report): Promise<string> {
  const now = Date.now();
  const outboxId = newId();
  await db.outbox.add({
    id: outboxId,
    reportId: report.id,
    status: 'queued',
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
    sentParts: [],
    createdAt: now,
    updatedAt: now,
  });
  await db.reports.update(report.id, {
    status: 'queued',
    updatedAt: now,
    lastError: null,
  });
  return outboxId;
}

/** Puts the next retry of every waiting item back to "now" and flushes. */
export async function retryAll(): Promise<FlushSummary> {
  const items = await db.outbox.toArray();
  await Promise.all(
    items
      .filter((item) => item.status === 'failed')
      .map((item) =>
        db.outbox.update(item.id, { status: 'queued', nextAttemptAt: 0, updatedAt: Date.now() }),
      ),
  );
  return flushQueue();
}

// --- Triggers -------------------------------------------------------------

let triggersInstalled = false;

export function installQueueTriggers(onChange?: () => void): () => void {
  if (triggersInstalled) return () => undefined;
  triggersInstalled = true;

  const kick = (reason: string) => {
    if (!navigator.onLine) return;
    void flushQueue().then((summary) => {
      if (summary.sent > 0 || summary.failed > 0) onChange?.();
      if (reason === 'background-sync' || summary.sent > 0) void registerBackgroundSync();
    });
  };

  const handleOnline = () => kick('online');
  const handleVisible = () => {
    if (document.visibilityState === 'visible') kick('visible');
  };
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'FLUSH_OUTBOX') kick('background-sync');
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisible);
  navigator.serviceWorker?.addEventListener('message', handleMessage);

  // A slow heartbeat covers the case where the network comes back without
  // firing an `online` event (common on flaky site connections).
  const interval = window.setInterval(() => {
    if (!navigator.onLine) return;
    void db.outbox
      .toArray()
      .then((items) => {
        if (items.some((item) => item.status !== 'sent')) kick('interval');
      })
      .catch(() => undefined);
  }, 60_000);

  kick('startup');

  return () => {
    triggersInstalled = false;
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisible);
    navigator.serviceWorker?.removeEventListener('message', handleMessage);
    window.clearInterval(interval);
  };
}

/** Android Chrome can wake the service worker after a reconnect; iOS Safari cannot. */
interface SyncRegistration extends ServiceWorkerRegistration {
  sync?: { register(tag: string): Promise<void> };
}

export async function registerBackgroundSync(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const registration = (await navigator.serviceWorker.ready) as SyncRegistration;
    if (!registration.sync) return false;
    await registration.sync.register('flush-outbox');
    return true;
  } catch {
    return false;
  }
}
