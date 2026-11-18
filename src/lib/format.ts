const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** yyyy-mm-dd for `<input type="date">` in local time (not UTC). */
export function todayIso(): string {
  const d = new Date();
  return isoFromDate(d);
}

export function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses yyyy-mm-dd as a local date, avoiding the UTC shift of `new Date(str)`. */
export function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "18 Nov 2026" — deterministic across devices, unlike toLocaleDateString. */
export function formatDate(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso || '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Wednesday 18 November 2026" for the PDF header. */
export function formatLongDate(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso || '—';
  const full = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ][d.getDay()];
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${full} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(isoFromDate(d))}, ${hh}:${mm}`;
}

/** "just now", "12 min ago", "Yesterday, 18:40", "18 Nov 2026". */
export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;

  const hours = Math.floor(min / 60);
  const d = new Date(ms);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');

  if (isToday) return hours < 6 ? `${hours} hr ago` : `Today, ${hh}:${mm}`;

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${hh}:${mm}`;

  return formatDate(isoFromDate(d));
}

/** "Today" / "Yesterday" / weekday for date separators in the reports list. */
export function dayLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return DAYS[d.getDay()] + ' ' + formatDate(isoFromDate(d));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function plural(n: number, singular: string, pluralForm?: string): string {
  return n === 1 ? singular : (pluralForm ?? `${singular}s`);
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
