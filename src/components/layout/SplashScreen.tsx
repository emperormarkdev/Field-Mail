import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';

let hasShownSplashInSession = false;

export function SplashScreen() {
  const [phase, setPhase] = useState<'active' | 'exiting' | 'done'>(() =>
    hasShownSplashInSession ? 'done' : 'active',
  );

  useEffect(() => {
    if (hasShownSplashInSession) return;
    hasShownSplashInSession = true;

    const exitTimer = window.setTimeout(() => {
      setPhase('exiting');
    }, 1350);

    const doneTimer = window.setTimeout(() => {
      setPhase('done');
    }, 1750);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        'fixed inset-0 z-100 flex flex-col items-center justify-center select-none overflow-hidden',
        'bg-linear-to-b from-[#2563eb] via-[#1d4ed8] to-[#1e3a8a] text-white',
        'transition-[opacity,transform] duration-400 ease-out',
        phase === 'exiting' ? 'pointer-events-none scale-[1.03] opacity-0' : 'scale-100 opacity-100',
      )}
    >
      {/* Subtle radial glow behind logo */}
      <div className="pointer-events-none absolute size-72 rounded-full bg-white/10 blur-3xl animate-[fm-pulse_1.8s_ease-in-out_infinite]" />

      <div className="relative flex flex-col items-center">
        {/* Animated Logo Container */}
        <div className="relative grid size-24 place-items-center rounded-[26px] bg-white/12 shadow-[0_20px_50px_rgba(0,0,0,0.28),inset_0_1px_1px_rgba(255,255,255,0.35)] backdrop-blur-md animate-[fm-icon-pop_550ms_cubic-bezier(0.22,1,0.36,1)_both]">
          <svg
            viewBox="0 0 96 96"
            className="size-20 overflow-visible"
            fill="none"
          >
            {/* Rising report document card */}
            <g className="animate-[fm-doc-rise_650ms_cubic-bezier(0.22,1,0.36,1)_220ms_both]">
              <rect x="24" y="14" width="48" height="42" rx="6" fill="#dbeafe" />
              <rect
                x="32"
                y="23"
                width="20"
                height="5"
                rx="2.5"
                fill="#1d4ed8"
                className="animate-[fm-line-grow_400ms_ease-out_450ms_both]"
              />
              <rect
                x="32"
                y="32"
                width="32"
                height="5"
                rx="2.5"
                fill="#2563eb"
                className="animate-[fm-line-grow_400ms_ease-out_560ms_both]"
              />
            </g>

            {/* Envelope body */}
            <path
              d="M14 40C14 37.79 15.79 36 18 36H78C80.21 36 82 37.79 82 40V72C82 76.42 78.42 80 74 80H22C17.58 80 14 76.42 14 72V40Z"
              fill="#ffffff"
              className="animate-[fm-env-in_450ms_cubic-bezier(0.22,1,0.36,1)_80ms_both]"
            />

            {/* Envelope V-flap fold */}
            <path
              d="M16 38.5L48 60L80 38.5"
              stroke="#2563eb"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="1"
              className="animate-[fm-flap-draw_520ms_cubic-bezier(0.33,1,0.68,1)_320ms_both]"
            />
          </svg>
        </div>

        {/* Wordmark */}
        <span className="mt-5 text-[1.5rem] font-bold tracking-[-0.025em] text-white animate-[fm-wordmark_500ms_cubic-bezier(0.22,1,0.36,1)_360ms_both]">
          Fieldmail
        </span>
      </div>
    </div>
  );
}

