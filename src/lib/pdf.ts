import { jsPDF } from 'jspdf';
import type { Field, LogoAlignment, Report, Settings, StoredPhoto } from '../types';
import { formatDate, formatLongDate } from './format';
import { readAsDataUrl } from './photos';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 14;
const BOTTOM_LIMIT = PAGE_H - MARGIN - FOOTER_H;

const BLACK: [number, number, number] = [0, 0, 0];
const DARK_GREY: [number, number, number] = [55, 55, 55];
const MID_GREY: [number, number, number] = [110, 110, 110];
const BORDER_GREY: [number, number, number] = [170, 170, 170];
const LIGHT_FILL: [number, number, number] = [246, 246, 246];

const BODY_PT = 10;
const BODY_LH = 5;

export interface PdfInput {
  report: Report;
  photos: StoredPhoto[];
  settings: Settings;
  part?: { index: number; count: number };
}

type Doc = jsPDF;

function valueLines(doc: Doc, value: string, width: number, pt = BODY_PT): string[] {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(pt);
  return doc.splitTextToSize(value, width) as string[];
}

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return String(value).trim() === '';
}

function fieldValueText(report: Report, field: Field): string {
  const raw = report.values[field.id];
  if (field.type === 'photo') return '';
  if (isEmptyValue(raw)) return '';
  if (Array.isArray(raw)) return raw.join(', ');
  return String(raw);
}

function drawHeader(
  doc: Doc,
  report: Report,
  settings: Settings,
  logo: { dataUrl: string; width: number; height: number } | null,
  part?: { index: number; count: number },
): number {
  let y = MARGIN;
  const brand = settings.branding.companyName.trim();
  const align: LogoAlignment = settings.branding.logoAlign ?? 'left';

  let logoW = 0;
  let logoH = 0;
  if (logo) {
    const maxW = 40;
    const maxH = 16;
    const ratio = logo.height / logo.width;
    logoW = maxW;
    logoH = logoW * ratio;
    if (logoH > maxH) {
      logoH = maxH;
      logoW = logoH / ratio;
    }
  }

  if (align === 'center') {
    if (logo) {
      const logoX = MARGIN + (CONTENT_W - logoW) / 2;
      doc.addImage(logo.dataUrl, 'JPEG', logoX, y, logoW, logoH);
      y += logoH + 4;
    }
    if (brand) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...DARK_GREY);
      doc.text(brand.toUpperCase(), PAGE_W / 2, y + 3, { align: 'center' });
      y += 6;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...BLACK);
    const titleLines = doc.splitTextToSize(report.templateName.toUpperCase(), CONTENT_W) as string[];
    doc.text(titleLines, PAGE_W / 2, y + 4, { align: 'center' });
    y += 4 + titleLines.length * 6.5;
  } else if (align === 'left') {
    if (logo) {
      doc.addImage(logo.dataUrl, 'JPEG', MARGIN, y, logoW, logoH);
      y += logoH + 4;
    }
    if (brand) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...DARK_GREY);
      doc.text(brand.toUpperCase(), MARGIN, y + 3);
      y += 5.5;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...BLACK);
    const titleLines = doc.splitTextToSize(report.templateName.toUpperCase(), CONTENT_W) as string[];
    doc.text(titleLines, MARGIN, y + 4);
    y += 4 + titleLines.length * 6.5;
  } else {
    // align === 'right'
    const startY = y;
    const textMaxW = logo ? CONTENT_W - logoW - 8 : CONTENT_W;
    if (logo) {
      doc.addImage(logo.dataUrl, 'JPEG', MARGIN + CONTENT_W - logoW, startY, logoW, logoH);
    }
    if (brand) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...DARK_GREY);
      doc.text(brand.toUpperCase(), MARGIN, y + 3);
      y += 5.5;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...BLACK);
    const titleLines = doc.splitTextToSize(report.templateName.toUpperCase(), textMaxW) as string[];
    doc.text(titleLines, MARGIN, y + 4);
    y += 4 + titleLines.length * 6.5;
    if (logo) {
      y = Math.max(y, startY + logoH + 4);
    }
  }

  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  y += 5;

  // Classic two-column bordered metadata table
  const preparedBy = settings.myName.trim() || settings.gmail.trim() || '—';
  const rows: Array<[string, string, string, string]> = [
    ['Site / Location', report.siteName || '—', 'Date', formatLongDate(report.reportDate)],
    [
      'Prepared by',
      preparedBy,
      part && part.count > 1 ? 'Attachment' : 'Report Type',
      part && part.count > 1 ? `Part ${part.index + 1} of ${part.count}` : report.templateName,
    ],
  ];

  const rowH = 7.5;
  const col1LabelW = 30;
  const col1ValW = CONTENT_W / 2 - col1LabelW;
  const col2LabelW = 28;
  const col2ValW = CONTENT_W / 2 - col2LabelW;
  const midX = MARGIN + CONTENT_W / 2;

  doc.setDrawColor(...BORDER_GREY);
  doc.setLineWidth(0.25);

  for (const [l1, v1, l2, v2] of rows) {
    doc.setFillColor(...LIGHT_FILL);
    doc.rect(MARGIN, y, col1LabelW, rowH, 'F');
    doc.rect(midX, y, col2LabelW, rowH, 'F');

    doc.rect(MARGIN, y, CONTENT_W, rowH, 'S');
    doc.line(MARGIN + col1LabelW, y, MARGIN + col1LabelW, y + rowH);
    doc.line(midX, y, midX, y + rowH);
    doc.line(midX + col2LabelW, y, midX + col2LabelW, y + rowH);

    const textY = y + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK_GREY);
    doc.text(l1, MARGIN + 2.5, textY);
    doc.text(l2, midX + 2.5, textY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...BLACK);
    const val1 = (doc.splitTextToSize(v1, col1ValW - 5) as string[])[0] ?? '';
    const val2 = (doc.splitTextToSize(v2, col2ValW - 5) as string[])[0] ?? '';
    doc.text(val1, MARGIN + col1LabelW + 2.5, textY);
    doc.text(val2, midX + col2LabelW + 2.5, textY);

    y += rowH;
  }

  return y + 8;
}

function renderField(
  doc: Doc,
  y: number,
  field: Field,
  report: Report,
  photos: StoredPhoto[],
  images: Map<string, { dataUrl: string; width: number; height: number }>,
): number {
  const value = fieldValueText(report, field);
  const fieldPhotos = photos.filter((p) => p.fieldId === field.id);

  if (field.type !== 'photo' && value === '') {
    if (fieldPhotos.length === 0) return y;
  }
  if (field.type === 'photo' && fieldPhotos.length === 0) {
    return y;
  }

  if (y + 14 > BOTTOM_LIMIT) {
    doc.addPage();
    y = MARGIN;
  }

  // Section heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text(field.label, MARGIN, y);
  y += 2;

  doc.setDrawColor(...BORDER_GREY);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  y += 5;

  if (field.type === 'checklist') {
    const options = field.options ?? [];
    const checked = Array.isArray(report.values[field.id])
      ? (report.values[field.id] as string[])
      : [];
    doc.setFontSize(BODY_PT);

    for (const option of options) {
      if (y + 6 > BOTTOM_LIMIT) {
        doc.addPage();
        y = MARGIN;
      }
      const isOn = checked.includes(option);
      const box = 3.4;
      doc.setDrawColor(...BLACK);
      doc.setLineWidth(0.3);
      doc.rect(MARGIN, y - 2.9, box, box, 'S');
      if (isOn) {
        doc.setLineWidth(0.5);
        doc.line(MARGIN + 0.7, y - 1.2, MARGIN + 1.4, y - 0.3);
        doc.line(MARGIN + 1.4, y - 0.3, MARGIN + 2.8, y - 2.3);
      }
      doc.setTextColor(...(isOn ? BLACK : DARK_GREY));
      doc.setFont('helvetica', isOn ? 'bold' : 'normal');
      doc.setFontSize(BODY_PT);
      doc.text(option, MARGIN + box + 3, y);
      y += 5.5;
    }
    y += 3;
  } else if (field.type === 'photo') {
    for (const photo of fieldPhotos) {
      const image = images.get(photo.id);
      if (!image) continue;

      const ratio = image.height / image.width;
      let drawW = Math.min(CONTENT_W, 140);
      let drawH = drawW * ratio;
      const MAX_H = 100;
      if (drawH > MAX_H) {
        drawH = MAX_H;
        drawW = drawH / ratio;
      }
      const captionH = photo.caption ? 6 : 0;

      if (y + drawH + captionH > BOTTOM_LIMIT) {
        doc.addPage();
        y = MARGIN;
      }

      doc.setDrawColor(...BORDER_GREY);
      doc.setLineWidth(0.25);
      doc.addImage(image.dataUrl, 'JPEG', MARGIN, y, drawW, drawH);
      doc.rect(MARGIN, y, drawW, drawH, 'S');
      y += drawH + 4;

      if (photo.caption) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...DARK_GREY);
        const lines = doc.splitTextToSize(photo.caption, CONTENT_W) as string[];
        doc.text(lines, MARGIN, y);
        y += lines.length * 4.2;
      }
      y += 4;
    }
    y += 2;
  } else {
    const lines = valueLines(doc, value, CONTENT_W);
    doc.setTextColor(...BLACK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(BODY_PT);

    for (const line of lines) {
      if (y + BODY_LH > BOTTOM_LIMIT) {
        doc.addPage();
        y = MARGIN;
      }
      doc.text(line, MARGIN, y);
      y += BODY_LH;
    }
    y += 4;
  }

  return y;
}

function drawFooters(doc: Doc, report: Report, settings: Settings): void {
  const total = doc.getNumberOfPages();

  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    const y = PAGE_H - MARGIN;

    doc.setDrawColor(...BORDER_GREY);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, y - 5, MARGIN + CONTENT_W, y - 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MID_GREY);

    const left = [
      settings.branding.companyName.trim(),
      report.templateName,
      report.siteName.trim(),
    ]
      .filter(Boolean)
      .join(' — ');
    doc.text(left, MARGIN, y);

    const right = `Page ${page} of ${total}`;
    const width = doc.getTextWidth(right);
    doc.text(right, MARGIN + CONTENT_W - width, y);
  }
}

export async function buildPdf(input: PdfInput): Promise<jsPDF> {
  const { report, photos, settings, part } = input;

  const images = new Map<string, { dataUrl: string; width: number; height: number }>();
  await Promise.all(
    photos.map(async (photo) => {
      images.set(photo.id, {
        dataUrl: await readAsDataUrl(photo.blob),
        width: photo.width,
        height: photo.height,
      });
    }),
  );

  let logo: { dataUrl: string; width: number; height: number } | null = null;
  if (settings.branding.logoDataUrl) {
    const dims = await imageSize(settings.branding.logoDataUrl);
    logo = { dataUrl: settings.branding.logoDataUrl, ...dims };
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: `${report.templateName} — ${report.siteName || 'Site'}`,
    subject: report.subject || report.templateName,
    author: settings.myName || settings.gmail || 'Fieldmail',
  });

  let y = drawHeader(doc, report, settings, logo, part);

  for (const field of report.templateSnapshot.fields) {
    y = renderField(doc, y, field, report, photos, images);
  }

  if (report.values.__notes && String(report.values.__notes).trim()) {
    y = renderField(
      doc,
      y,
      { id: '__notes', type: 'long', label: 'Additional notes', required: false },
      report,
      photos,
      images,
    );
  }

  drawFooters(doc, report, settings);
  return doc;
}

function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = dataUrl;
  });
}

export async function buildPdfBlob(input: PdfInput): Promise<Blob> {
  const doc = await buildPdf(input);
  return doc.output('blob');
}

export async function buildPdfBase64(input: PdfInput): Promise<{ base64: string; bytes: number }> {
  const doc = await buildPdf(input);
  const buffer = doc.output('arraybuffer');
  const bytes = buffer.byteLength;
  const view = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...view.subarray(i, i + chunk));
  }
  return { base64: btoa(binary), bytes };
}

export function pdfFilename(report: Report, part?: { index: number; count: number }): string {
  const site = (report.siteName || 'site').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-');
  const name = report.templateName.replace(/[^\w\-]+/g, '-').replace(/-+/g, '-');
  const suffix = part && part.count > 1 ? `-part${part.index + 1}` : '';
  return `${name}-${site}-${report.reportDate}${suffix}.pdf`;
}

export interface SummaryPdfInput {
  reports: Report[];
  settings: Settings;
  startDate: string;
  endDate: string;
  siteFilter?: string;
}

export async function buildSummaryPdfBlob(input: SummaryPdfInput): Promise<Blob> {
  const { reports, settings, startDate, endDate, siteFilter } = input;
  const sorted = [...reports].sort((a, b) =>
    a.reportDate === b.reportDate
      ? a.createdAt - b.createdAt
      : a.reportDate.localeCompare(b.reportDate),
  );

  let logo: { dataUrl: string; width: number; height: number } | null = null;
  if (settings.branding.logoDataUrl) {
    const dims = await imageSize(settings.branding.logoDataUrl);
    logo = { dataUrl: settings.branding.logoDataUrl, ...dims };
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const periodLabel = `${formatDate(startDate)} – ${formatDate(endDate)}`;
  const siteLabel = siteFilter?.trim() || 'All sites';

  doc.setProperties({
    title: `Site Summary Report — ${siteLabel} (${periodLabel})`,
    subject: 'Site Summary Report',
    author: settings.myName || settings.gmail || 'Fieldmail',
  });

  let y = MARGIN;
  const brand = settings.branding.companyName.trim();
  const align: LogoAlignment = settings.branding.logoAlign ?? 'left';

  let logoW = 0;
  let logoH = 0;
  if (logo) {
    const maxW = 40;
    const maxH = 16;
    const ratio = logo.height / logo.width;
    logoW = maxW;
    logoH = logoW * ratio;
    if (logoH > maxH) {
      logoH = maxH;
      logoW = logoH / ratio;
    }
  }

  if (align === 'center') {
    if (logo) {
      doc.addImage(logo.dataUrl, 'JPEG', MARGIN + (CONTENT_W - logoW) / 2, y, logoW, logoH);
      y += logoH + 4;
    }
    if (brand) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...DARK_GREY);
      doc.text(brand.toUpperCase(), PAGE_W / 2, y + 3, { align: 'center' });
      y += 6;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...BLACK);
    doc.text('SITE SUMMARY REPORT', PAGE_W / 2, y + 4, { align: 'center' });
    y += 10.5;
  } else if (align === 'left') {
    if (logo) {
      doc.addImage(logo.dataUrl, 'JPEG', MARGIN, y, logoW, logoH);
      y += logoH + 4;
    }
    if (brand) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...DARK_GREY);
      doc.text(brand.toUpperCase(), MARGIN, y + 3);
      y += 5.5;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...BLACK);
    doc.text('SITE SUMMARY REPORT', MARGIN, y + 4);
    y += 10.5;
  } else {
    const startY = y;
    if (logo) {
      doc.addImage(logo.dataUrl, 'JPEG', MARGIN + CONTENT_W - logoW, startY, logoW, logoH);
    }
    if (brand) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...DARK_GREY);
      doc.text(brand.toUpperCase(), MARGIN, y + 3);
      y += 5.5;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...BLACK);
    doc.text('SITE SUMMARY REPORT', MARGIN, y + 4);
    y += 10.5;
    if (logo) y = Math.max(y, startY + logoH + 4);
  }

  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  y += 5;

  // Summary metadata grid
  const preparedBy = settings.myName.trim() || settings.gmail.trim() || '—';
  const metaRows: Array<[string, string, string, string]> = [
    ['Site / Location', siteLabel, 'Period', periodLabel],
    ['Prepared by', preparedBy, 'Total Reports', `${sorted.length}`],
  ];
  const rowH = 7.5;
  const col1LabelW = 30;
  const col1ValW = CONTENT_W / 2 - col1LabelW;
  const col2LabelW = 28;
  const col2ValW = CONTENT_W / 2 - col2LabelW;
  const midX = MARGIN + CONTENT_W / 2;

  doc.setDrawColor(...BORDER_GREY);
  doc.setLineWidth(0.25);

  for (const [l1, v1, l2, v2] of metaRows) {
    doc.setFillColor(...LIGHT_FILL);
    doc.rect(MARGIN, y, col1LabelW, rowH, 'F');
    doc.rect(midX, y, col2LabelW, rowH, 'F');
    doc.rect(MARGIN, y, CONTENT_W, rowH, 'S');
    doc.line(MARGIN + col1LabelW, y, MARGIN + col1LabelW, y + rowH);
    doc.line(midX, y, midX, y + rowH);
    doc.line(midX + col2LabelW, y, midX + col2LabelW, y + rowH);

    const textY = y + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK_GREY);
    doc.text(l1, MARGIN + 2.5, textY);
    doc.text(l2, midX + 2.5, textY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...BLACK);
    doc.text((doc.splitTextToSize(v1, col1ValW - 5) as string[])[0] ?? '', MARGIN + col1LabelW + 2.5, textY);
    doc.text((doc.splitTextToSize(v2, col2ValW - 5) as string[])[0] ?? '', midX + col2LabelW + 2.5, textY);
    y += rowH;
  }

  y += 8;

  // Chronological reports log
  for (let idx = 0; idx < sorted.length; idx++) {
    const item = sorted[idx];
    if (y + 22 > BOTTOM_LIMIT) {
      doc.addPage();
      y = MARGIN;
    }

    // Report header banner
    doc.setFillColor(...LIGHT_FILL);
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.35);
    doc.rect(MARGIN, y, CONTENT_W, 8, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BLACK);
    const headerTitle = `${idx + 1}. ${formatDate(item.reportDate)} — ${item.templateName} (${
      item.siteName || 'No site'
    })`;
    doc.text((doc.splitTextToSize(headerTitle, CONTENT_W - 6) as string[])[0] ?? '', MARGIN + 3, y + 5.4);
    y += 12;

    for (const field of item.templateSnapshot.fields) {
      if (field.type === 'photo') continue;
      const val = fieldValueText(item, field);
      if (!val) continue;

      if (y + 12 > BOTTOM_LIMIT) {
        doc.addPage();
        y = MARGIN;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...DARK_GREY);
      doc.text(`${field.label}:`, MARGIN, y);
      y += 4.5;

      const lines = valueLines(doc, val, CONTENT_W, 9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...BLACK);
      for (const line of lines) {
        if (y + 4.8 > BOTTOM_LIMIT) {
          doc.addPage();
          y = MARGIN;
        }
        doc.text(line, MARGIN, y);
        y += 4.8;
      }
      y += 2.5;
    }

    y += 4;
  }

  // Footers
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    const fy = PAGE_H - MARGIN;
    doc.setDrawColor(...BORDER_GREY);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, fy - 5, MARGIN + CONTENT_W, fy - 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MID_GREY);
    const left = [brand, 'Site Summary Report', periodLabel].filter(Boolean).join(' — ');
    doc.text(left, MARGIN, fy);
    const right = `Page ${page} of ${total}`;
    doc.text(right, MARGIN + CONTENT_W - doc.getTextWidth(right), fy);
  }

  return doc.output('blob');
}

export function summaryPdfFilename(startDate: string, endDate: string, siteFilter?: string): string {
  const site = (siteFilter?.trim() || 'all-sites').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-');
  return `Site-Summary-${site}-${startDate}-to-${endDate}.pdf`;
}
