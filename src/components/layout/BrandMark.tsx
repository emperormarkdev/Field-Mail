import { cn } from '../../lib/cn';

export function BrandMark({ size = 32, showName = true }: { size?: number; showName?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg
        viewBox="0 0 40 40"
        width={size}
        height={size}
        aria-hidden
        className={cn('shrink-0 rounded-[9px] shadow-xs', showName && 'size-8')}
        style={showName ? undefined : { width: size, height: size }}
      >
        <defs>
          <linearGradient id="fm-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="9" fill="url(#fm-bg)" />
        {/* Document card rising from envelope */}
        <rect x="11" y="7" width="18" height="17" rx="2.5" fill="#dbeafe" />
        <rect x="14" y="10.5" width="8" height="2" rx="1" fill="#1d4ed8" />
        <rect x="14" y="14.5" width="12" height="2" rx="1" fill="#2563eb" />
        {/* Envelope body */}
        <path
          d="M7 16.5C7 15.67 7.67 15 8.5 15H31.5C32.33 15 33 15.67 33 16.5V29.5C33 31.16 31.66 32.5 30 32.5H10C8.34 32.5 7 31.16 7 29.5V16.5Z"
          fill="#ffffff"
        />
        {/* Envelope flap fold */}
        <path
          d="M7.5 16L20 24.5L32.5 16"
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showName && (
        <span className="text-headline-bold tracking-[-0.02em] text-ink">Fieldmail</span>
      )}
    </span>
  );
}
