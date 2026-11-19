import { promises as dns } from 'node:dns';
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
  smtpHost?: unknown;
  smtpPort?: unknown;
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

const HOST_RE = /^(?=.{4,120}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const ALLOWED_PORTS = new Set([465, 587, 2525]);

function cleanSmtpHost(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') return null;
  const host = value.trim().toLowerCase();
  if (!HOST_RE.test(host)) return null;
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    return null;
  }
  return host;
}

function cleanSmtpPort(value: unknown, host: string): number {
  if (typeof value === 'number' && ALLOWED_PORTS.has(value)) return value;
  return host === 'smtp.office365.com' || host === 'smtp.protonmail.ch' || host === 'smtp.mail.me.com'
    ? 587
    : 465;
}

interface SmtpCandidate {
  host: string;
  port: number;
}

const DIRECT_DOMAIN_SMTP: Record<string, SmtpCandidate> = {
  'gmail.com': { host: 'smtp.gmail.com', port: 465 },
  'googlemail.com': { host: 'smtp.gmail.com', port: 465 },
  'outlook.com': { host: 'smtp.office365.com', port: 587 },
  'hotmail.com': { host: 'smtp.office365.com', port: 587 },
  'live.com': { host: 'smtp.office365.com', port: 587 },
  'msn.com': { host: 'smtp.office365.com', port: 587 },
  'yahoo.com': { host: 'smtp.mail.yahoo.com', port: 465 },
  'ymail.com': { host: 'smtp.mail.yahoo.com', port: 465 },
  'zoho.com': { host: 'smtp.zoho.com', port: 465 },
  'zohomail.com': { host: 'smtp.zoho.com', port: 465 },
  'proton.me': { host: 'smtp.protonmail.ch', port: 587 },
  'protonmail.com': { host: 'smtp.protonmail.ch', port: 587 },
  'pm.me': { host: 'smtp.protonmail.ch', port: 587 },
  'icloud.com': { host: 'smtp.mail.me.com', port: 587 },
  'me.com': { host: 'smtp.mail.me.com', port: 587 },
  'fastmail.com': { host: 'smtp.fastmail.com', port: 465 },
};

function mapMxToSmtp(mxHost: string): SmtpCandidate | null {
  const mx = mxHost.toLowerCase().replace(/\.$/, '');
  if (mx.includes('google.com') || mx.includes('googlemail.com')) {
    return { host: 'smtp.gmail.com', port: 465 };
  }
  if (mx.includes('outlook.com') || mx.includes('microsoft.com')) {
    return { host: 'smtp.office365.com', port: 587 };
  }
  if (mx.includes('yahoodns.net') || mx.includes('yahoo.com')) {
    return { host: 'smtp.mail.yahoo.com', port: 465 };
  }
  if (mx.includes('zoho.eu')) return { host: 'smtp.zoho.eu', port: 465 };
  if (mx.includes('zoho.in')) return { host: 'smtp.zoho.in', port: 465 };
  if (mx.includes('zoho.')) return { host: 'smtp.zoho.com', port: 465 };
  if (mx.includes('protonmail.ch')) return { host: 'smtp.protonmail.ch', port: 587 };
  if (mx.includes('privateemail.com')) return { host: 'mail.privateemail.com', port: 465 };
  if (mx.includes('secureserver.net')) return { host: 'smtpout.secureserver.net', port: 465 };
  if (mx.includes('titan.email')) return { host: 'smtp.titan.email', port: 465 };
  if (mx.includes('messagingengine.com') || mx.includes('fastmail.')) {
    return { host: 'smtp.fastmail.com', port: 465 };
  }
  if (mx.includes('icloud.com') || mx.includes('apple.com')) {
    return { host: 'smtp.mail.me.com', port: 587 };
  }
  if (mx.includes('yandex.')) return { host: 'smtp.yandex.com', port: 465 };
  return null;
}

async function detectSmtpCandidates(email: string): Promise<SmtpCandidate[]> {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  if (!domain) return [{ host: 'smtp.gmail.com', port: 465 }];

  const direct = DIRECT_DOMAIN_SMTP[domain];
  if (direct) return [direct];
  if (domain.startsWith('yahoo.')) return [{ host: 'smtp.mail.yahoo.com', port: 465 }];

  const candidates: SmtpCandidate[] = [];
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('mx_timeout')), 3000)),
    ]);
    records.sort((a, b) => a.priority - b.priority);
    for (const rec of records) {
      const mapped = mapMxToSmtp(rec.exchange);
      if (mapped && !candidates.some((c) => c.host === mapped.host && c.port === mapped.port)) {
        candidates.push(mapped);
      }
    }
    if (candidates.length > 0) return candidates;
  } catch {
    // Fall through to standard company mail server conventions
  }

  const mailHost = cleanSmtpHost(`mail.${domain}`);
  if (mailHost) {
    candidates.push({ host: mailHost, port: 465 });
    candidates.push({ host: mailHost, port: 587 });
  }
  const smtpSub = cleanSmtpHost(`smtp.${domain}`);
  if (smtpSub) {
    candidates.push({ host: smtpSub, port: 587 });
  }
  return candidates.length > 0 ? candidates : [{ host: 'smtp.gmail.com', port: 465 }];
}

function isAuthError(err: unknown): boolean {
  const e = err as { code?: string; responseCode?: number } | null;
  return e?.code === 'EAUTH' || e?.responseCode === 535 || e?.responseCode === 534;
}

function createSmtpTransport(host: string, port: number, user: string, rawPass: string) {
  const pass = host === 'smtp.gmail.com' ? rawPass.replace(/\s/g, '') : rawPass.trim();
  if (!user || !pass) return null;
  const secure = port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 8_000,
    socketTimeout: 18_000,
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

  // Use the user's own email + password + auto-detected or custom SMTP, falling back to server env vars if configured
  const userEmail = isEmail(raw.senderEmail) ? raw.senderEmail.trim().toLowerCase() : '';
  const userPass = typeof raw.senderAppPassword === 'string' ? raw.senderAppPassword.trim() : '';

  const usingUserCreds = Boolean(userEmail && userPass);
  const explicitHost = usingUserCreds ? cleanSmtpHost(raw.smtpHost) : 'smtp.gmail.com';
  if (explicitHost === null) {
    seenKeys.delete(dedupeKey);
    error(
      res,
      400,
      'invalid_smtp_host',
      'Enter a valid SMTP server hostname in Settings (for example, mail.yourdomain.com).',
      false,
    );
    return;
  }

  const smtpUser = usingUserCreds ? userEmail : (process.env.GMAIL_USER?.trim() || '');
  const smtpPass = usingUserCreds ? userPass : (process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '') || '');

  if (!smtpUser || !smtpPass) {
    seenKeys.delete(dedupeKey);
    error(
      res,
      400,
      'missing_sender_credentials',
      'Enter your email address and password in Settings to send directly from your email account.',
      false,
    );
    return;
  }

  const candidates: SmtpCandidate[] = explicitHost
    ? [{ host: explicitHost, port: cleanSmtpPort(raw.smtpPort, explicitHost) }]
    : await detectSmtpCandidates(smtpUser);

  const filename =
    typeof pdf.filename === 'string' && pdf.filename.length > 0
      ? pdf.filename.replace(/[^\w.\-]/g, '_').slice(0, 120)
      : 'fieldmail-report.pdf';

  const senderName =
    typeof raw.senderName === 'string'
      ? raw.senderName.replace(/["<>]/g, '').trim().slice(0, 80)
      : '';
  const fromDisplay = senderName || 'Fieldmail';

  let lastError: unknown = null;
  for (const candidate of candidates) {
    const transport = createSmtpTransport(candidate.host, candidate.port, smtpUser, smtpPass);
    if (!transport) continue;
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
      return;
    } catch (err) {
      lastError = err;
      if (isAuthError(err)) break;
    } finally {
      transport.close();
    }
  }

  seenKeys.delete(dedupeKey);
  const authFailed = isAuthError(lastError);
  error(
    res,
    502,
    'mail_failed',
    authFailed
      ? 'Sign-in was rejected by your email provider. Make sure you entered the right email and App Password (or email password).'
      : 'Could not connect to your email server automatically. Open Advanced server settings in Settings to enter your mail server.',
    true,
  );
}
