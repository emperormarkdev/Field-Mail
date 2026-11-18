import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useRuntime } from '../../app/AppRuntime';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';

const DISMISS_KEY = 'fieldmail-install-dismissed';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const { installPrompt, promptInstall, isIos, isStandalone } = useRuntime();
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [showIosHelp, setShowIosHelp] = useState(false);

  const available = (installPrompt !== null || isIos) && !isStandalone && !dismissed;
  if (!available) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode */
    }
    setDismissed(true);
  };

  return (
    <>
      <div className="animate-rise fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-md rounded-card border border-line-strong bg-surface p-3 shadow-lg lg:inset-x-auto lg:bottom-5 lg:right-5 lg:max-w-xs">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-field bg-accent-soft text-accent">
            <Download aria-hidden className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.875rem] font-semibold text-ink">Use it like an app</p>
            <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">
              Install Fieldmail for a full-screen, offline-ready home screen icon.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install suggestion"
            className="press -mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-field text-muted hover:bg-raised"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="primary"
            className="min-h-11 flex-1"
            onClick={() => (installPrompt ? void promptInstall() : setShowIosHelp(true))}
          >
            {installPrompt ? 'Install app' : 'How to install'}
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>

      <Sheet
        open={showIosHelp}
        onClose={() => setShowIosHelp(false)}
        title="Add to Home Screen"
        description="iPhone and iPad don't offer an automatic install button."
      >
        <ol className="flex flex-col gap-4 text-[0.9375rem] leading-relaxed text-ink">
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.75rem] font-bold text-accent">
              1
            </span>
            Tap the Share button at the bottom of Safari.
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.75rem] font-bold text-accent">
              2
            </span>
            Scroll down the menu and tap <strong>Add to Home Screen</strong>.
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.75rem] font-bold text-accent">
              3
            </span>
            Tap Add. Fieldmail then opens full-screen, even offline.
          </li>
        </ol>
        <p className="mt-5 flex items-start gap-2 rounded-field bg-raised p-3 text-[0.8125rem] leading-snug text-muted">
          <Share aria-hidden className="mt-0.5 size-4 shrink-0" />
          The Share icon is a square with an arrow pointing up.
        </p>
      </Sheet>
    </>
  );
}
