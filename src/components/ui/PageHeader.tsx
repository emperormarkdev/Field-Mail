import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RiArrowLeftLine, RiMoonLine, RiSunLine } from '@remixicon/react';
import { BrandMark } from '../layout/BrandMark';
import { useSettings } from '../../hooks/useSettings';
import { cn } from '../../lib/cn';

export function PageHeader({
  title,
  description,
  backTo,
  backLabel = 'Back',
  actions,
  sticky = true,
  className,
}: {
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  const { resolvedTheme, toggleTheme } = useSettings();

  return (
    <header
      className={cn(
        'z-20 -mx-4 mb-4 border-b border-separator-border bg-surface/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:mx-0 lg:mb-5 lg:border-b-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none',
        sticky && 'sticky top-0 lg:static',
        className,
      )}
    >
      <div className="mx-auto flex min-h-14 w-full max-w-[1120px] items-center justify-between gap-2.5 py-2.5 lg:py-5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {backTo ? (
            <Link
              to={backTo}
              aria-label={backLabel}
              className="press -ms-1 grid size-9 shrink-0 place-items-center rounded-xl border border-border-button-default bg-background-primary-default text-text-primary shadow-2xs hover:bg-background-primary-hover"
            >
              <RiArrowLeftLine aria-hidden className="size-4.5" />
            </Link>
          ) : (
            <span className="lg:hidden">
              <BrandMark size={28} showName={false} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-headline-semibold text-ink sm:text-title-2-semibold">
              {title}
            </h1>
            {description && (
              <p className="truncate text-caption-1-regular text-muted sm:text-body-2-regular">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {actions}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="press grid size-9 cursor-pointer place-items-center rounded-xl border border-border-button-default bg-background-primary-default text-text-secondary shadow-2xs hover:bg-background-primary-hover hover:text-text-primary lg:hidden"
          >
            {resolvedTheme === 'dark' ? (
              <RiSunLine aria-hidden className="size-4.5" />
            ) : (
              <RiMoonLine aria-hidden className="size-4.5" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
