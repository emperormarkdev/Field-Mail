import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useRuntime } from '../../app/AppRuntime';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';

const DISMISS_KEY = 'fieldmail-pwa-prompt-dismissed';

function wasDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
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
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore storage errors */
    }
    setDismissed(true);
  };

  return (
    <>
      <div className="animate-rise fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md rounded-2xl border border-line-strong bg-surface p-3.5 shadow-xl lg:inset-x-auto lg:bottom-5 lg:end-5 lg:max-w-xs">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-white">
            <Download aria-hidden className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-body-semibold text-ink">Install Fieldmail App</p>
            <p className="text-caption-1-regular text-muted">
              Add to your phone for full-screen offline use.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close install banner"
            className="press grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-muted hover:bg-raised"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="primary"
            fullWidth
            onClick={() => (installPrompt ? void promptInstall() : setShowIosHelp(true))}
          >
            {installPrompt ? 'Install now' : 'How to install'}
          </Button>
        </div>
      </div>

      <Sheet
        open={showIosHelp}
        onClose={() => setShowIosHelp(false)}
        title="Install Fieldmail on iPhone"
        description="Follow these 3 quick steps in Safari to install the full-screen app:"
      >
        <ol className="flex flex-col gap-4 text-body-regular text-ink">
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-caption-1-bold text-accent">
              1
            </span>
            Tap the Share button at the bottom of Safari.
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-caption-1-bold text-accent">
              2
            </span>
            Scroll down and tap <strong>Add to Home Screen</strong>.
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-caption-1-bold text-accent">
              3
            </span>
            Tap <strong>Add</strong>. Fieldmail will open as a full-screen mobile app.
          </li>
        </ol>
        <p className="mt-5 flex items-start gap-2 rounded-field bg-raised p-3 text-body-2-regular text-muted">
          <Share aria-hidden className="mt-0.5 size-4 shrink-0" />
          The Share icon is a square with an arrow pointing up.
        </p>
      </Sheet>
    </>
  );
}
