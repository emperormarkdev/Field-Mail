export type FieldType =
  | 'short'
  | 'long'
  | 'number'
  | 'date'
  | 'time'
  | 'dropdown'
  | 'checklist'
  | 'photo';

export interface Field {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  /** Options for `dropdown` and `checklist` fields. */
  options?: string[];
  /** Small helper line rendered under the label. */
  help?: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  /**
   * Subject line pattern. Tokens: [Type] [Site] [Date] [Time].
   * e.g. "[Type] – [Site] – [Date]"
   */
  subjectPattern: string;
  fields: Field[];
  defaultRecipientIds: string[];
  isStarter?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ReportStatus = 'draft' | 'queued' | 'sending' | 'sent' | 'failed';

export type FieldValue = string | string[] | null;

export interface RecipientAssignment {
  to: string[];
  cc: string[];
  bcc: string[];
}

export interface Report {
  id: string;
  templateId: string;
  templateName: string;
  /** Frozen copy of the template at creation time so edits never rewrite history. */
  templateSnapshot: Template;
  siteName: string;
  /** yyyy-mm-dd */
  reportDate: string;
  values: Record<string, FieldValue>;
  status: ReportStatus;
  /** Filled in when the report is queued. */
  recipients: RecipientAssignment;
  subject: string;
  createdAt: number;
  updatedAt: number;
  sentAt: number | null;
  /** How many emails this report was split into. */
  partCount?: number;
  lastError?: string | null;
}

export interface StoredPhoto {
  id: string;
  reportId: string;
  fieldId: string;
  blob: Blob;
  /** Small copy for lists and thumbnails. */
  thumb: Blob;
  caption: string;
  width: number;
  height: number;
  createdAt: number;
}

export interface Recipient {
  id: string;
  name: string;
  email: string;
  label?: string;
  createdAt: number;
}

export type OutboxStatus = 'queued' | 'sending' | 'sent' | 'failed';

export interface OutboxItem {
  id: string;
  /** Also serves as the idempotency key together with `partIndex`. */
  reportId: string;
  status: OutboxStatus;
  attempts: number;
  /** Epoch ms; the queue will not touch this item before this time. */
  nextAttemptAt: number;
  lastError: string | null;
  /** Part indexes already accepted by the server, so a retry never re-sends them. */
  sentParts: number[];
  createdAt: number;
  updatedAt: number;
}

export type ThemeMode = 'system' | 'light' | 'dark';

export type LogoAlignment = 'left' | 'center' | 'right';

export interface Branding {
  companyName: string;
  logoDataUrl: string | null;
  logoAlign?: LogoAlignment;
}

export interface Settings {
  id: 'app';
  myName: string;
  gmail: string;
  /** Device-local only, entered once in Settings. Never bundled into the build. */
  accessKey: string;
  defaultSiteName: string;
  lastSiteName: string;
  sendMeCopy: boolean;
  theme: ThemeMode;
  branding: Branding;
  createdAt: number;
}

/** Wire format accepted by /api/send. */
export interface SendPayload {
  reportId: string;
  attemptId: string;
  partIndex: number;
  partCount: number;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  pdf: { filename: string; base64: string };
  photos?: Array<{ filename: string; base64: string }>;
}
