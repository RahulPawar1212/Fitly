'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { FoodSheetHost } from '@/components/food/FoodSheetHost';
import { BottomNav } from '@/components/nav/BottomNav';
import { Spinner } from '@/components/ui/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { DayProvider } from '@/context/DayContext';

/** Routes that render on their own, with no nav and no data loading. */
const PUBLIC_ROUTES = ['/login', '/signup'];

/**
 * Decides whether to render the app or send you to sign in.
 *
 * The gate lives here rather than in middleware because it also controls
 * MOUNTING: DayProvider must not mount for a signed-out visitor, or it would
 * fire `/api/day`, take a 401, and bounce back — a redirect loop instead of a
 * login page. Middleware still does a cheap cookie check for direct navigations
 * (see middleware.ts); this is the authoritative gate.
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

  if (isPublic) return <>{children}</>;

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
