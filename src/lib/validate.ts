import type { Field, Report, StoredPhoto } from '../types';

/** Deliberately permissive: DOMAIN, and no spaces. Rejects obvious typos only. */
const EMAIL_RE = /^[^\s@,;:]+@[^\s@,;:]+\.[^\s@,;:]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export interface ReportValidation {
  fieldErrors: Record<string, string>;
  messages: string[];
  valid: boolean;
}

function hasText(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim().length > 0;
}

export function validateReport(report: Report, photos: StoredPhoto[]): ReportValidation {
  const fieldErrors: Record<string, string> = {};
  const messages: string[] = [];

  for (const field of report.templateSnapshot.fields as Field[]) {
    if (!field.required) continue;

    if (field.type === 'photo') {
      const count = photos.filter((photo) => photo.fieldId === field.id).length;
      if (count === 0) {
        fieldErrors[field.id] = 'Add at least one photo.';
        messages.push(field.label);
      }
      continue;
    }

    if (!hasText(report.values[field.id])) {
      fieldErrors[field.id] =
        field.type === 'checklist' ? 'Tick at least one option.' : 'This is needed before sending.';
      messages.push(field.label);
    }
  }

  if (!report.templateName.trim()) {
    fieldErrors.templateName = 'Add a report title.';
    messages.push('Report title');
  }

  if (!report.siteName.trim()) {
    fieldErrors.siteName = 'Add the site name.';
    messages.push('Site name');
  }

  return { fieldErrors, messages, valid: messages.length === 0 };
}
