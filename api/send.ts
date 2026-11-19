import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export const config = {
  api: {
    bodyParser: { sizeLimit: '4.5mb' },
  },
};

const EMAIL_RE = /^[^\s@,;:]+@[^\s@,;:]+\.[^\s@,;:]{2,}$/;
const MAX_BODY_BYTES = 4_500_000;
const MAX_PDF_BYTES = 4_000_000;
const MAX_HTML_BYTES = 400_000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 30;
const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;

interface SendBody {
  reportId?: unknown;
  attemptId?: unknown;
  partIndex?: unknown;
  partCount?: unknown;
  to?: unknown;
  cc?: unknown;
  bcc?: unknown;
  senderName?: unknown;
  senderEmail?: unknown;
  senderAppPassword?: unknown;
  subject?: unknown;
  html?: unknown;
  text?: unknown;
  pdf?: { filename?: unknown; base64?: unknown };
  photos?: Array<{ filename?: unknown; base64?: unknown }>;
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const seenKeys = new Map<string, number>();

function error(res: VercelResponse, status: number, code: string, message: string, retryable: boolean) {
  res.status(status).json({ error: { code, message, retryable } });
}

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value.trim());
}

function cleanAddresses(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 25) return null;
  const result: string[] = [];
  for (const item of value) {
    if (!isEmail(item)) return null;
    result.push(item.trim().toLowerCase());
  }
  return Array.from(new Set(result));
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT;
}

function createGmailTransport(user: string, rawPass: string) {
  const pass = rawPass.replace(/\s/g, '');
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    error(res, 405, 'method_not_allowed', 'Only POST is allowed.', false);
    return;
  }

  const ip =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.socket?.remoteAddress) || 'unknown';
  if (!checkRateLimit(ip)) {
    res.setHeader('Retry-After', '600');
    error(res, 429, 'rate_limited', 'Too many emails in a short time. Try again in ten minutes.', true);
    return;
  }

  const raw = req.body as SendBody | undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    error(res, 400, 'invalid_payload', 'The request body must be a JSON object.', false);
    return;
  }

  try {
    if (Buffer.byteLength(JSON.stringify(raw), 'utf8') > MAX_BODY_BYTES) {
      error(res, 413, 'too_large', 'This report is too large to send in one email.', false);
      return;
    }
  } catch {
    error(res, 400, 'invalid_payload', 'The request could not be read.', false);
    return;
  }

  const { reportId, attemptId, partIndex, partCount, subject, html, pdf } = raw;
  const to = cleanAddresses(raw.to);
  const cc = cleanAddresses(raw.cc);
  const bcc = cleanAddresses(raw.bcc);

  if (
    typeof reportId !== 'string' ||
    reportId.length < 4 ||
    reportId.length > 100 ||
    typeof attemptId !== 'string' ||
    attemptId.length < 4 ||
    attemptId.length > 100 ||
    !Number.isInteger(partIndex) ||
    (partIndex as number) < 0 ||
    (partIndex as number) > 24 ||
    !Number.isInteger(partCount) ||
    (partCount as number) < 1 ||
    (partCount as number) > 25 ||
    !to ||
    !cc ||
    !bcc ||
    to.length + cc.length + bcc.length === 0 ||
    typeof subject !== 'string' ||
    subject.trim().length === 0 ||
    subject.length > 200 ||
    typeof html !== 'string' ||
    Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES ||
    !pdf ||
    typeof pdf.base64 !== 'string'
  ) {
    error(res, 400, 'invalid_payload', 'The report payload is missing required information.', false);
    return;
  }

  let pdfBuffer: Buffer;
  try {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(pdf.base64 as string)) throw new Error('bad base64');
    pdfBuffer = Buffer.from(pdf.base64 as string, 'base64');
  } catch {
    error(res, 400, 'invalid_attachment', 'The PDF attachment is not valid base64.', false);
    return;
  }
  if (pdfBuffer.length === 0 || pdfBuffer.length > MAX_PDF_BYTES) {
    error(res, 413, 'attachment_too_large', 'The PDF attachment exceeds the size limit.', false);
    return;
  }

  const photoBuffers: Array<{ filename: string; content: Buffer }> = [];
  if (raw.photos) {
    if (!Array.isArray(raw.photos) || raw.photos.length > 25) {
      error(res, 400, 'invalid_attachment', 'Too many photo attachments.', false);
      return;
    }
    for (const photo of raw.photos) {
      if (!photo || typeof photo.base64 !== 'string' || typeof photo.filename !== 'string') {
        error(res, 400, 'invalid_attachment', 'A photo attachment is malformed.', false);
        return;
      }
      const buffer = Buffer.from(photo.base64, 'base64');
      if (buffer.length > MAX_PDF_BYTES) {
        error(res, 413, 'attachment_too_large', 'A photo attachment exceeds the size limit.', false);
        return;
      }
      photoBuffers.push({
        filename: photo.filename.replace(/[^\w.\-]/g, '_').slice(0, 100) || 'photo.jpg',
        content: buffer,
      });
    }
  }

  const dedupeKey = `${attemptId}:${partIndex}`;
  const previous = seenKeys.get(dedupeKey);
  if (previous && previous > Date.now()) {
    res.status(200).json({ ok: true, duplicate: true, reportId });
    return;
  }
  if (seenKeys.size > 2000) {
    const now = Date.now();
    for (const [key, expires] of seenKeys) {
      if (expires <= now) seenKeys.delete(key);
    }
  }
  seenKeys.set(dedupeKey, Date.now() + DEDUPE_TTL_MS);

  // Use the visitor's own Gmail + App Password if provided, falling back to server env vars if configured
  const userEmail = isEmail(raw.senderEmail) ? raw.senderEmail.trim().toLowerCase() : '';
  const userPass =
    typeof raw.senderAppPassword === 'string' ? raw.senderAppPassword.replace(/\s/g, '') : '';

  const smtpUser = userEmail && userPass ? userEmail : (process.env.GMAIL_USER?.trim() || '');
  const smtpPass = userEmail && userPass ? userPass : (process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '') || '');

  if (!smtpUser || !smtpPass) {
    seenKeys.delete(dedupeKey);
    error(
      res,
      400,
      'missing_sender_credentials',
      'Enter your Gmail address and 16-character Gmail App Password in Settings to send directly from your email.',
      false,
    );
    return;
  }

  const transport = createGmailTransport(smtpUser, smtpPass);
  if (!transport) {
    seenKeys.delete(dedupeKey);
    error(res, 400, 'missing_sender_credentials', 'Invalid Gmail credentials.', false);
    return;
  }

  const filename =
    typeof pdf.filename === 'string' && pdf.filename.length > 0
      ? pdf.filename.replace(/[^\w.\-]/g, '_').slice(0, 120)
      : 'fieldmail-report.pdf';

  const senderName =
    typeof raw.senderName === 'string'
      ? raw.senderName.replace(/["<>]/g, '').trim().slice(0, 80)
      : '';
  const fromDisplay = senderName || 'Fieldmail';

  try {
    await transport.sendMail({
      from: `"${fromDisplay}" <${smtpUser}>`,
      replyTo: userEmail || smtpUser,
      to,
      cc,
      bcc,
      subject: subject.trim(),
      text: typeof raw.text === 'string' ? raw.text.slice(0, 100_000) : undefined,
      html,
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
        ...photoBuffers,
      ],
    });

    res.status(200).json({
      ok: true,
      reportId,
      partIndex,
      partCount,
    });
  } catch {
    seenKeys.delete(dedupeKey);
    error(
      res,
      502,
      'mail_failed',
      'Gmail could not send this email. Make sure your Gmail address and 16-character Gmail App Password in Settings are correct.',
      true,
    );
  } finally {
    transport.close();
  }
}
