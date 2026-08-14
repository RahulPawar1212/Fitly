'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { FoodSheetHost } from '@/components/food/FoodSheetHost';
import { BottomNav } from '@/components/nav/BottomNav';
import { Spinner } from '@/components/ui/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { DayProvider } from '@/context/DayContext';

/**
 * Routes that render on their own, with no nav and no data loading.
 *
 * `/help` is included because it fetches nothing — it should be readable before
 * signing up, and it is the one page that must still work when something else is
 * broken.
 */
const PUBLIC_ROUTES = ['/login', '/signup', '/help'];

/**
 * Decides whether to render the app or send you to sign in.
 *
 * The gate lives here rather than in the proxy because it also controls
 * MOUNTING: DayProvider must not mount for a signed-out visitor, or it would
 * fire `/api/day`, take a 401, and bounce back — a redirect loop instead of a
 * login page. `src/proxy.ts` still does a cheap cookie check for direct
 * navigations; this is the authoritative gate.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      // Remember where they were headed, so signing in returns them there.
      const next = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${next}`);
    }
    // The signed-in case is deliberately NOT handled here: AuthForm performs its
    // own redirect after login, and racing it from this effect would cancel the
    // `?next=` destination.
  }, [user, loading, isPublic, pathname, router]);

  // A signed-out visitor on a public page gets the bare page: no nav to tap and
  // no data layer to 401. A signed-IN visitor falls through to the full shell
  // below, so reading /help doesn't strand them without the bottom nav.
  if (isPublic && !user) return <>{children}</>;

  // Waiting on /api/auth/me, or mid-redirect. Showing a spinner rather than the
  // app avoids a flash of someone else's empty dashboard.
  if (loading || !user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Spinner label={loading ? 'Loading' : 'Redirecting to sign in'} />
      </div>
    );
  }

  return (
    <DayProvider>
      {/* Bottom padding clears the fixed nav plus the phone's home bar. */}
      <div className="pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
        <main className="mx-auto w-full max-w-md px-4">{children}</main>
      </div>
      <BottomNav />
      <FoodSheetHost />
    </DayProvider>
  );
}
