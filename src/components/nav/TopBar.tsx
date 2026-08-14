import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Screen header. Carries Help, History and Profile so the bottom nav can stay at
 * five items.
 */
export function TopBar({
  title,
  subtitle,
  showHelp = true,
  showHistory = true,
  showProfile = true,
  back,
  brand = false,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** The "?" icon. On by default — help should never be more than one tap away. */
  showHelp?: boolean;
  showHistory?: boolean;
  showProfile?: boolean;
  /** href for a back chevron, when this screen is a sub-page. */
  back?: string;
  /** Show the Fitzora wordmark above the title. Home screen only. */
  brand?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={brand ? 'pt-3' : undefined}>
      {brand && (
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">
          Fitzora
        </p>
      )}
      <header className={`flex items-center gap-1 pb-2 ${brand ? 'pt-0.5' : 'pt-4'}`}>
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

      {showHelp && (
        <Link
          href="/help"
          aria-label="Help — how this app works"
          title="How this app works"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="9" />
            {/* Question mark, drawn rather than typed so it scales with the icon. */}
            <path d="M9.2 9.3a2.9 2.9 0 015.6 1c0 1.9-2.8 2.3-2.8 4" strokeLinecap="round" />
            <path d="M12 17.6h.01" strokeLinecap="round" strokeWidth={2.5} />
          </svg>
        </Link>
      )}

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
    </div>
  );
}
