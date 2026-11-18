import { Link, NavLink, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RiAddLine,
  RiFileList3Fill,
  RiFileList3Line,
  RiHome5Fill,
  RiHome5Line,
  RiLayoutGridFill,
  RiLayoutGridLine,
  RiMoonLine,
  RiSettings4Fill,
  RiSettings4Line,
  RiSunLine,
} from '@remixicon/react';
import { db } from '../../db/db';
import { BrandMark } from './BrandMark';
import { useSettings } from '../../hooks/useSettings';
import { useOnline } from '../../hooks/useOnline';
import { useOutbox } from '../../hooks/useOutbox';
import { cn } from '../../lib/cn';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: RiHome5Line, activeIcon: RiHome5Fill, end: true },
  { to: '/reports', label: 'Reports', icon: RiFileList3Line, activeIcon: RiFileList3Fill, end: false },
  { to: '/templates', label: 'Templates', icon: RiLayoutGridLine, activeIcon: RiLayoutGridFill, end: false },
  { to: '/settings', label: 'Settings', icon: RiSettings4Line, activeIcon: RiSettings4Fill, end: false },
];

export function BottomNav() {
  const { count: waitingCount } = useOutbox();
  const location = useLocation();

  const leftItems = NAV_ITEMS.slice(0, 2);
  const rightItems = NAV_ITEMS.slice(2, 4);

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-separator-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
        {leftItems.map(({ to, label, icon: Icon, activeIcon: ActiveIcon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'press relative flex h-full flex-col items-center justify-center gap-1 select-none',
                isActive ? 'text-accent' : 'text-text-tertiary hover:text-text-primary',
              )
            }
          >
            {({ isActive }) => {
              const Glyph = isActive ? ActiveIcon : Icon;
              return (
                <>
                  <span
                    className={cn(
                      'relative flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                      isActive && 'bg-accent-soft',
                    )}
                  >
                    <Glyph aria-hidden className="size-5" />
                    {to === '/reports' && waitingCount > 0 && (
                      <span className="absolute -top-0.5 end-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white">
                        {waitingCount}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-[11px] leading-none',
                      isActive ? 'font-semibold text-accent' : 'font-medium text-text-secondary',
                    )}
                  >
                    {label}
                  </span>
                </>
              );
            }}
          </NavLink>
        ))}

        <div className="flex items-center justify-center">
          <Link
            to="/new"
            aria-label="New report"
            className={cn(
              'press flex size-11 items-center justify-center rounded-full bg-button-primary text-white shadow-sm',
              location.pathname === '/new' && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
            )}
          >
            <RiAddLine aria-hidden className="size-6" />
          </Link>
        </div>

        {rightItems.map(({ to, label, icon: Icon, activeIcon: ActiveIcon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'press relative flex h-full flex-col items-center justify-center gap-1 select-none',
                isActive ? 'text-accent' : 'text-text-tertiary hover:text-text-primary',
              )
            }
          >
            {({ isActive }) => {
              const Glyph = isActive ? ActiveIcon : Icon;
              return (
                <>
                  <span
                    className={cn(
                      'relative flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                      isActive && 'bg-accent-soft',
                    )}
                  >
                    <Glyph aria-hidden className="size-5" />
                  </span>
                  <span
                    className={cn(
                      'text-[11px] leading-none',
                      isActive ? 'font-semibold text-accent' : 'font-medium text-text-secondary',
                    )}
                  >
                    {label}
                  </span>
                </>
              );
            }}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function SideNav() {
  const { settings, resolvedTheme, toggleTheme } = useSettings();
  const online = useOnline();
  const { count: waitingCount } = useOutbox();
  const reportCount = useLiveQuery(() => db.reports.count(), [], 0);
  const templateCount = useLiveQuery(() => db.templates.count(), [], 0);

  const senderName = settings?.myName?.trim() || 'Sender profile';
  const senderEmail = settings?.gmail?.trim() || 'Click to configure email';

  return (
    <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-separator-border bg-surface lg:flex">
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Link to="/" className="focus-visible:outline-none">
          <BrandMark />
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="press grid size-8 cursor-pointer place-items-center rounded-lg border border-border-button-default bg-background-primary-default text-text-secondary shadow-2xs hover:bg-background-primary-hover hover:text-text-primary"
        >
          {resolvedTheme === 'dark' ? (
            <RiSunLine aria-hidden className="size-4" />
          ) : (
            <RiMoonLine aria-hidden className="size-4" />
          )}
        </button>
      </div>

      <div className="px-4 pb-3">
        <Link
          to="/new"
          className="press flex h-10 w-full items-center justify-center gap-2 rounded-2lg bg-button-primary px-3.5 text-body-semibold text-white shadow-xs"
        >
          <RiAddLine aria-hidden className="size-4.5" />
          New report
        </Link>
      </div>

      <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 px-3 pt-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, activeIcon: ActiveIcon, end }) => {
          const badge =
            to === '/reports'
              ? waitingCount > 0
                ? `${waitingCount} waiting`
                : reportCount > 0
                  ? String(reportCount)
                  : null
              : to === '/templates' && templateCount > 0
                ? String(templateCount)
                : null;

          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'press flex h-10 items-center justify-between gap-2.5 rounded-2lg px-3 text-body-medium',
                  isActive
                    ? 'bg-accent-soft text-accent font-semibold'
                    : 'text-text-secondary hover:bg-background-secondary-default hover:text-text-primary',
                )
              }
            >
              {({ isActive }) => {
                const Glyph = isActive ? ActiveIcon : Icon;
                return (
                  <>
                    <span className="flex items-center gap-2.5">
                      <Glyph aria-hidden className="size-4.5 shrink-0" />
                      <span>{label}</span>
                    </span>
                    {badge && (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-caption-2-semibold',
                          to === '/reports' && waitingCount > 0
                            ? 'bg-warn-soft text-warn'
                            : isActive
                              ? 'bg-accent/15 text-accent'
                              : 'bg-background-tertiary-default text-text-secondary',
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </>
                );
              }}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-separator-border p-3">
        <Link
          to="/settings"
          className="press flex items-center gap-3 rounded-xl p-2 hover:bg-background-secondary-default"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-body-semibold text-accent">
            {(settings?.myName?.trim()?.[0] || settings?.gmail?.trim()?.[0] || 'F').toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-body-2-semibold text-ink">{senderName}</p>
              <span
                aria-hidden
                title={online ? 'Online' : 'Offline'}
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  online ? 'bg-emerald-500' : 'bg-amber-500',
                )}
              />
            </div>
            <p className="truncate text-caption-1-regular text-muted">{senderEmail}</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
