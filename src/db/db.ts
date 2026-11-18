import Dexie, { type Table } from 'dexie';
import type {
  OutboxItem,
  Recipient,
  Report,
  Settings,
  StoredPhoto,
  Template,
  FieldValue,
} from '../types';
import { DEFAULT_SETTINGS, STARTER_TEMPLATES } from './starters';
import { newId } from '../lib/id';

export class SiteReportDB extends Dexie {
  templates!: Table<Template, string>;
  reports!: Table<Report, string>;
  photos!: Table<StoredPhoto, string>;
  recipients!: Table<Recipient, string>;
  outbox!: Table<OutboxItem, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('sitereport');

    this.version(1).stores({
      templates: 'id, name, updatedAt',
      reports: 'id, status, createdAt, updatedAt, templateId',
      photos: 'id, reportId, fieldId, createdAt',
      recipients: 'id, email, name, createdAt',
      outbox: 'id, reportId, status, nextAttemptAt, createdAt',
      settings: 'id',
    });

    this.version(2).stores({
      recipients: 'id, email, name, createdAt',
    });

    this.version(3)
      .stores({
        templates: 'id, name, updatedAt',
        reports: 'id, status, createdAt, updatedAt, templateId',
        photos: 'id, reportId, fieldId, createdAt',
        recipients: 'id, email, name, createdAt',
        outbox: 'id, reportId, status, nextAttemptAt, createdAt',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        const current = await tx.table<Settings, string>('settings').get('app');
        if (current && current.theme === 'system') {
          await tx.table<Settings, string>('settings').put({ ...current, theme: 'light' });
        }
        const count = await tx.table<Template, string>('templates').count();
        if (count === 0) {
          await tx.table<Template, string>('templates').bulkPut(STARTER_TEMPLATES);
        }
      });

    this.on('populate', () => {
      this.templates.bulkAdd(STARTER_TEMPLATES);
      this.settings.add(DEFAULT_SETTINGS);
    });
  }
}

export const db = new SiteReportDB();

export async function getTemplate(id: string): Promise<Template | undefined> {
  const found = await db.templates.get(id);
  if (found) return found;
  const starter = STARTER_TEMPLATES.find((item) => item.id === id);
  if (starter) {
    await db.templates.put(starter);
    return starter;
  }
  return undefined;
}

export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get('app');
  if (existing) {
    if (!existing.accessKey || !existing.gmail) {
      const patched: Settings = {
        ...existing,
        gmail: existing.gmail || 'markchukwudiokezie@gmail.com',
        accessKey: existing.accessKey || 'fieldmail2026',
      };
      await db.settings.put(patched);
      return patched;
    }
    return existing;
  }
  const initial: Settings = {
    ...DEFAULT_SETTINGS,
    gmail: 'markchukwudiokezie@gmail.com',
    accessKey: 'fieldmail2026',
  };
  await db.settings.put(initial);
  return initial;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await db.settings.put(next);
  return next;
}

/**
 * Photos can outlive the undo window for a deleted report (the blob is kept so
 * Undo can restore it instantly). Anything with no parent is swept on boot.
 */
export async function purgeOrphanPhotos(): Promise<void> {
  const photos = await db.photos.toArray();
  if (photos.length === 0) return;
  const reportIds = new Set((await db.reports.toCollection().primaryKeys()) as string[]);
  const orphans = photos.filter((p) => !reportIds.has(p.reportId)).map((p) => p.id);
  if (orphans.length) await db.photos.bulkDelete(orphans);
}

export async function deleteReportCascade(reportId: string): Promise<void> {
  await db.transaction('rw', db.reports, db.outbox, db.photos, async () => {
    await db.reports.delete(reportId);
    await db.outbox.where('reportId').equals(reportId).delete();
    await db.photos.where('reportId').equals(reportId).delete();
  });
}

export function createReportDraft(params: {
  template: Template;
  siteName: string;
  reportDate: string;
  values: Record<string, FieldValue>;
}): Report {
  const now = Date.now();
  return {
    id: newId(),
    templateId: params.template.id,
    templateName: params.template.name,
    templateSnapshot: structuredClone(params.template),
    siteName: params.siteName,
    reportDate: params.reportDate,
    values: params.values,
    status: 'draft',
    recipients: { to: [], cc: [], bcc: [] },
    subject: '',
    createdAt: now,
    updatedAt: now,
    sentAt: null,
    lastError: null,
  };
}
