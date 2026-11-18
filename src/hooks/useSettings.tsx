import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getSettings, updateSettings as persistSettings } from '../db/db';
import type { Settings, ThemeMode } from '../types';

interface SettingsContextValue {
  settings: Settings | null;
  loading: boolean;
  resolvedTheme: 'light' | 'dark';
  update: (patch: Partial<Settings>) => Promise<Settings>;
  toggleTheme: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>');
  return value;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    let alive = true;
    void getSettings()
      .then((value) => {
        if (alive) setSettings(value);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const mode: ThemeMode = settings?.theme ?? 'light';
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const dark = mode === 'dark' || (mode === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) meta.setAttribute('content', dark ? 'dark' : 'light');
      setResolvedTheme(dark ? 'dark' : 'light');
    };

    apply();
    try {
      localStorage.setItem('fieldmail-theme', mode);
      localStorage.setItem('sitereport-theme', mode);
    } catch {
      /* ignore storage errors */
    }
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings?.theme]);

  const update = useCallback(async (patch: Partial<Settings>) => {
    const next = await persistSettings(patch);
    setSettings(next);
    return next;
  }, []);

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    void update({ theme: next });
  }, [resolvedTheme, update]);

  const value = useMemo(
    () => ({ settings, loading, resolvedTheme, update, toggleTheme }),
    [settings, loading, resolvedTheme, update, toggleTheme],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
