import { NavLink } from 'react-router-dom';
import { FileText, House, LayoutTemplate, Moon, Settings2, Sun } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { useSettings } from '../../hooks/useSettings';
import { cn } from '../../lib/cn';

const ITEMS = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/reports', label: 'Reports', icon: FileText, end: false },
  { to: '/templates', label: 'Templates', icon: LayoutTemplate, end: false },
  { to: '/settings', label: 'Settings', icon: Settings2, end: false },
];

const itemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'press flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-field text-caption-2-semibold sm:flex-row sm:gap-2 sm:px-3 sm:text-body-medium',
    isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-raised hover:text-ink',
  );

export function BottomNav() {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-1">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={itemClass}>
            <Icon aria-hidden className="size-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function SideNav() {
  const { resolvedTheme, toggleTheme } = useSettings();

  return (
    <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e border-line bg-surface lg:flex">
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <BrandMark />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="press grid size-9 place-items-center rounded-field border border-line bg-canvas text-muted hover:bg-raised hover:text-ink"
        >
          {resolvedTheme === 'dark' ? (
            <Sun aria-hidden className="size-4" />
          ) : (
            <Moon aria-hidden className="size-4" />
          )}
        </button>
      </div>
      <nav aria-label="Main navigation" className="flex flex-col gap-1 px-3">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={cn(
              'press flex min-h-10 items-center gap-3 rounded-field px-3 text-body-medium',
              'text-muted hover:bg-raised hover:text-ink',
              'aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent',
            )}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
