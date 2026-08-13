import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Screen header. Carries History and Profile so the bottom nav can stay at five
 * items.
 */
export function TopBar({
  title,
  subtitle,
  showHistory = true,
  showProfile = true,
  back,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  showHistory?: boolean;
  showProfile?: boolean;
  /** href for a back chevron, when this screen is a sub-page. */
  back?: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-1 pt-4 pb-2">
      {back && (
        <Link
          href={back}
          aria-label="Back"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-semibold">{title}</h1>
        {subtitle && (
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>

      {children}

      {showHistory && (
        <Link
          href="/history"
          aria-label="History"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 11h18" strokeLinecap="round" />
          </svg>
        </Link>
      )}

      {showProfile && (
        <Link
          href="/profile"
          aria-label="Profile"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" strokeLinecap="round" />
          </svg>
        </Link>
      )}
    </header>
  );
}
