'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useDay } from '@/context/DayContext';

/**
 * Fixed bottom navigation, five targets.
 *
 * The raised centre "+" is not a route — it opens the food sheet as a client
 * action, so logging works identically from every tab. History and Profile live
 * in the TopBar to keep this bar at five items, which is the most that stays
 * thumb-comfortable on a phone.
 */

const ICON = 'h-6 w-6';

function TodayIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  );
}

function DiaryIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4z" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6" strokeLinecap="round" />
    </svg>
  );
}

function ExerciseIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 9v6M20 9v6M7 7v10M17 7v10M7 12h10" strokeLinecap="round" />
    </svg>
  );
}

function StatsIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" />
    </svg>
  );
}

const TABS = [
  { href: '/', label: 'Today', Icon: TodayIcon },
  { href: '/diary', label: 'Diary', Icon: DiaryIcon },
  { href: '/exercise', label: 'Exercise', Icon: ExerciseIcon },
  { href: '/stats', label: 'Stats', Icon: StatsIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { openFoodSheet } = useDay();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2">
        {TABS.slice(0, 2).map(({ href, label, Icon }) => (
          <NavLink key={href} href={href} label={label} active={isActive(href)}>
            <Icon />
          </NavLink>
        ))}

        {/* Raised primary action. Deliberately a button, not a link. */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => openFoodSheet()}
            aria-label="Add food"
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 transition active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {TABS.slice(2).map(({ href, label, Icon }) => (
          <NavLink key={href} href={href} label={label} active={isActive(href)}>
            <Icon />
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function NavLink({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition ${
        active
          ? 'text-brand-600 dark:text-brand-400'
          : 'text-slate-400 dark:text-slate-500'
      }`}
    >
      {children}
      <span>{label}</span>
    </Link>
  );
}
