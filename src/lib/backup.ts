import { db, getSettings } from '../db/db';
import type { Recipient, Report, Settings, StoredPhoto, Template } from '../types';
import { blobToBase64 } from './photos';

const BACKUP_VERSION = 1;

interface BackupPhoto extends Omit<StoredPhoto, 'blob' | 'thumb'> {
  blob: string;
  thumb: string;
  blobType: string;
  thumbType: string;
}

export interface BackupFile {
  app: 'Fieldmail' | 'SiteReport';
  version: number;
  exportedAt: string;
  templates: Template[];
  reports: Report[];
  recipients: Recipient[];
  photos: BackupPhoto[];
  settings: Omit<Settings, 'accessKey'>;
}

export async function exportBackup(): Promise<Blob> {
  const [templates, reports, recipients, photos, settings] = await Promise.all([
    db.templates.toArray(),
    db.reports.toArray(),
    db.recipients.toArray(),
    db.photos.toArray(),
    getSettings(),
  ]);

  const encodedPhotos: BackupPhoto[] = [];
  for (const photo of photos) {
    encodedPhotos.push({
      ...photo,
      blob: await blobToBase64(photo.blob),
      thumb: await blobToBase64(photo.thumb),
      blobType: photo.blob.type || 'image/jpeg',
      thumbType: photo.thumb.type || 'image/jpeg',
    });
  }

  // The access key is a device secret; it is never written to a shareable file.
  const safeSettings: Partial<Settings> = { ...settings };
  delete safeSettings.accessKey;

  const backup: BackupFile = {
    app: 'Fieldmail',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    templates,
    reports,
    recipients,
    photos: encodedPhotos,
    settings: safeSettings as Omit<Settings, 'accessKey'>,
  };

  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function importBackup(file: File): Promise<{ reports: number; templates: number }> {
  const text = await file.text();

  let parsed: BackupFile;
  try {
    parsed = JSON.parse(text) as BackupFile;
  } catch {
    throw new Error('That file is not a valid backup.');
  }

  if ((parsed.app !== 'Fieldmail' && parsed.app !== 'SiteReport') || !Array.isArray(parsed.reports)) {
    throw new Error('That backup was not created by Fieldmail.');
  }

  const photos: StoredPhoto[] = (parsed.photos ?? []).map((photo) => ({
    ...photo,
    blob: base64ToBlob(photo.blob, photo.blobType ?? 'image/jpeg'),
    thumb: base64ToBlob(photo.thumb, photo.thumbType ?? 'image/jpeg'),
  }));

  const current = await getSettings();

  await db.transaction(
    'rw',
    [db.templates, db.reports, db.photos, db.recipients, db.outbox, db.settings],
    async () => {
      await Promise.all([
        db.templates.clear(),
        db.reports.clear(),
        db.photos.clear(),
        db.recipients.clear(),
        db.outbox.clear(),
      ]);

      if (parsed.templates?.length) await db.templates.bulkAdd(parsed.templates);
      if (parsed.reports?.length) await db.reports.bulkAdd(parsed.reports);
      if (photos.length) await db.photos.bulkAdd(photos);
      if (parsed.recipients?.length) await db.recipients.bulkAdd(parsed.recipients);

      if (parsed.settings) {
        // Keep the local access key — the backup deliberately carries none.
        await db.settings.put({ ...parsed.settings, id: 'app', accessKey: current.accessKey });
      }
    },
  );

  return { reports: parsed.reports.length, templates: parsed.templates?.length ?? 0 };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
