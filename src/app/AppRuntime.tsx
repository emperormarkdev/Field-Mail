import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { registerSW } from 'virtual:pwa-register';
import { db, purgeOrphanPhotos } from '../db/db';
import { installQueueTriggers, registerBackgroundSync } from '../lib/queue';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface RuntimeContextValue {
  needRefresh: boolean;
  applyUpdate: () => void;
  offlineReady: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
  promptInstall: () => Promise<void>;
  isStandalone: boolean;
  isIos: boolean;
  storagePersisted: boolean | null;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

export function useRuntime(): RuntimeContextValue {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error('useRuntime must be used inside <AppRuntime>');
  return value;
}

export function AppRuntime({ children }: { children: ReactNode }) {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);
  const updateRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const isIos = /ipad|iphone|ipod/i.test(navigator.platform || navigator.userAgent);

  useEffect(() => {
    void (async () => {
      try {
        await db.open();
        await purgeOrphanPhotos();
      } catch {
        // Queries still surface their own errors; don't block the UI on cleanup.
      }

      try {
        if (navigator.storage?.persisted) {
          const already = await navigator.storage.persisted();
          setStoragePersisted(already);
          if (!already && navigator.storage.persist) {
            const granted = await navigator.storage.persist();
            setStoragePersisted(granted);
          }
        }
      } catch {
        setStoragePersisted(null);
      }
    })();
  }, []);

  useEffect(() => installQueueTriggers(), []);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    let updating = false;
    updateRef.current = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => setOfflineReady(true),
      onRegisteredSW: () => {
        void registerBackgroundSync();
      },
    });

    const onControllerChange = () => {
      if (updating) return;
      updating = true;
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange);

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onInstallPrompt);

    return () => {
      navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      updateRef.current = null;
    };
  }, []);

  const applyUpdate = useCallback(() => {
    setNeedRefresh(false);
    if (updateRef.current) {
      void updateRef.current(true);
      return;
    }
    // Fallback for a worker registered outside vite-plugin-pwa's helper.
    navigator.serviceWorker?.controller?.postMessage({ type: 'SKIP_WAITING' });
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }, [installPrompt]);

  const value = useMemo(
    () => ({
      needRefresh,
      applyUpdate,
      offlineReady,
      installPrompt,
      promptInstall,
      isStandalone,
      isIos,
      storagePersisted,
    }),
    [
      needRefresh,
      applyUpdate,
      offlineReady,
      installPrompt,
      promptInstall,
      isStandalone,
      isIos,
      storagePersisted,
    ],
  );

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}
