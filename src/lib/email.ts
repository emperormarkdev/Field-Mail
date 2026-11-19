import type { Field, Report, SendPayload, Settings, StoredPhoto } from '../types';
import { formatDate, formatLongDate } from './format';
import { buildPdfBase64, pdfFilename } from './pdf';
import { resolveSmtpConfig } from './emailProviders';

const MAX_BASE64_CHARS = 3_400_000;
const PDF_OVERHEAD_BYTES = 300_000;

export function buildSubject(report: Report): string {
  const pattern = report.templateSnapshot.subjectPattern || '[Type] – [Site] – [Date]';
  const subject = pattern
    .replace(/\[Type\]/gi, report.templateName)
    .replace(/\[Site\]/gi, report.siteName || 'Site')
    .replace(/\[Date\]/gi, formatDate(report.reportDate))
    .replace(/\s+/g, ' ')
    .trim();
  return subject.length > 180 ? `${subject.slice(0, 177)}…` : subject;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type PhotoCounts = Record<string, number>;

function displayValue(field: Field, report: Report, photoCounts: PhotoCounts): string {
  if (field.type === 'photo') {
    const n = photoCounts[field.id] ?? 0;
    return n ? `${n} photo${n === 1 ? '' : 's'} included in the attached PDF` : '';
  }
  const raw = report.values[field.id];
  if (raw == null) return '';
  if (Array.isArray(raw)) return raw.length ? raw.join(', ') : '';
  return String(raw).trim();
}

export function countPhotosByField(photos: StoredPhoto[]): PhotoCounts {
  const counts: PhotoCounts = {};
  for (const photo of photos) counts[photo.fieldId] = (counts[photo.fieldId] ?? 0) + 1;
  return counts;
}

export function buildHtmlBody(params: {
  report: Report;
  settings: Settings;
  photoCounts: PhotoCounts;
  totalPhotos: number;
  part?: { index: number; count: number };
}): string {
  const { report, settings, photoCounts, totalPhotos, part } = params;
  const brand = settings.branding.companyName.trim();
  const preparedBy = settings.myName.trim() || settings.gmail.trim() || '';
  const align = settings.branding.logoAlign ?? 'left';

  const sections = report.templateSnapshot.fields
    .map((field) => {
      const value = displayValue(field, report, photoCounts);
      if (!value) return '';
      return `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #d4d4d4;">
  <div style="font-size:12px;font-weight:700;color:#111111;margin-bottom:4px;">${escapeHtml(
    field.label,
  )}</div>
  <div style="font-size:14px;line-height:1.55;color:#111111;white-space:pre-wrap;">${escapeHtml(
    value,
  )}</div>
</div>`;
    })
    .filter(Boolean)
    .join('');

  const partLine =
    part && part.count > 1
      ? `<p style="margin:12px 0 0;padding:10px 12px;background:#f5f5f5;border:1px solid #d4d4d4;font-size:13px;line-height:1.5;color:#222222;">Email ${
          part.index + 1
        } of ${part.count}. Photos are split across ${
          part.count
        } emails to fit email size limits. The full written report is included below and in each attached PDF.</p>`
      : '';

  const photoLine =
    totalPhotos > 0
      ? `<p style="margin:16px 0 0;font-size:13px;color:#444444;">${totalPhotos} photo${
          totalPhotos === 1 ? ' is' : 's are'
        } included in the attached printable PDF.</p>`
      : '';

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#ffffff;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:680px;margin:0 auto;padding:24px 16px;">
      <div style="text-align:${align};border-bottom:2px solid #000000;padding-bottom:12px;">
        ${
          brand
            ? `<div style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#333333;margin-bottom:4px;">${escapeHtml(
                brand,
              )}</div>`
            : ''
        }
        <h1 style="margin:0;font-size:20px;line-height:1.25;color:#000000;font-weight:700;">${escapeHtml(
          report.templateName,
        )}</h1>
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:12px;border:1px solid #bdbdbd;border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="padding:7px 10px;background:#f5f5f5;border:1px solid #bdbdbd;font-weight:700;width:22%;">Site</td>
          <td style="padding:7px 10px;border:1px solid #bdbdbd;width:28%;">${escapeHtml(
            report.siteName || '—',
          )}</td>
          <td style="padding:7px 10px;background:#f5f5f5;border:1px solid #bdbdbd;font-weight:700;width:22%;">Date</td>
          <td style="padding:7px 10px;border:1px solid #bdbdbd;width:28%;">${escapeHtml(
            formatLongDate(report.reportDate),
          )}</td>
        </tr>
        ${
          preparedBy
            ? `<tr>
          <td style="padding:7px 10px;background:#f5f5f5;border:1px solid #bdbdbd;font-weight:700;">Prepared by</td>
          <td colspan="3" style="padding:7px 10px;border:1px solid #bdbdbd;">${escapeHtml(
            preparedBy,
          )}</td>
        </tr>`
            : ''
        }
      </table>

      ${partLine}
      ${sections}
      ${photoLine}

      <div style="margin-top:24px;padding-top:12px;border-top:1px solid #d4d4d4;font-size:12px;color:#555555;">
        A printable PDF copy of this report is attached to this email.
      </div>
    </div>
  </body>
</html>`;
}

export function buildTextBody(report: Report, settings: Settings, photoCounts: PhotoCounts): string {
  const lines: string[] = [];
  if (settings.branding.companyName.trim()) {
    lines.push(settings.branding.companyName.trim().toUpperCase());
  }
  lines.push(report.templateName.toUpperCase());
  lines.push('========================================');
  lines.push(`Site: ${report.siteName || '—'}`);
  lines.push(`Date: ${formatLongDate(report.reportDate)}`);
  if (settings.myName.trim() || settings.gmail.trim()) {
    lines.push(`Prepared by: ${settings.myName.trim() || settings.gmail.trim()}`);
  }
  lines.push('');

  for (const field of report.templateSnapshot.fields) {
    const value = displayValue(field, report, photoCounts);
    if (value) {
      lines.push(`${field.label}:`);
      lines.push(value);
      lines.push('');
    }
  }
  lines.push('----------------------------------------');
  lines.push('A printable PDF copy of this report is attached.');
  return lines.join('\n');
}

export interface BuiltPart extends SendPayload {
  base64Size: number;
}

export async function buildParts(params: {
  report: Report;
  photos: StoredPhoto[];
  settings: Settings;
  attemptId: string;
}): Promise<BuiltPart[]> {
  const { report, photos, settings, attemptId } = params;

  const budget = MAX_BASE64_CHARS * 0.73 - PDF_OVERHEAD_BYTES;
  const groups: StoredPhoto[][] = [];
  let current: StoredPhoto[] = [];
  let currentSize = 0;

  for (const photo of photos) {
    if (current.length > 0 && currentSize + photo.blob.size > budget) {
      groups.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(photo);
    currentSize += photo.blob.size;
  }
  groups.push(current);

  const built: BuiltPart[] = [];

  for (let index = 0; index < groups.length; index++) {
    const group = groups[index];
    const part = { index, count: groups.length };
    const { base64 } = await buildPdfBase64({ report, photos: group, settings, part });

    if (base64.length > MAX_BASE64_CHARS && group.length > 1) {
      const mid = Math.ceil(group.length / 2);
      groups.splice(index, 1, group.slice(0, mid), group.slice(mid));
      index--;
      continue;
    }

    const photoCounts = countPhotosByField(group);
    const subject = buildSubject(report);
    const { smtpHost, smtpPort } = resolveSmtpConfig(settings);

    built.push({
      reportId: report.id,
      attemptId,
      partIndex: index,
      partCount: groups.length,
      to: report.recipients.to,
      cc: report.recipients.cc,
      bcc: report.recipients.bcc,
      senderName: settings.myName.trim() || undefined,
      senderEmail: settings.gmail.trim() || undefined,
      senderAppPassword: settings.accessKey.trim() || undefined,
      smtpHost: smtpHost || undefined,
      smtpPort,
      subject: groups.length > 1 ? `${subject} (Part ${index + 1} of ${groups.length})` : subject,
      html: buildHtmlBody({
        report,
        settings,
        photoCounts,
        totalPhotos: group.length,
        part,
      }),
      text: buildTextBody(report, settings, photoCounts),
      pdf: { filename: pdfFilename(report, part), base64 },
      base64Size: base64.length,
    });
  }

  return built;
}
