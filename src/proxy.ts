import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cheap cookie-presence gate for direct navigations.
 *
 * Next 16 renamed the `middleware` file convention to `proxy` (same behaviour,
 * new file and export name), and it must sit beside `app/` — hence
 * `src/proxy.ts` rather than a root `middleware.ts`.
 *
 * This deliberately does NOT verify the session: proxy code runs before render,
 * is meant to be CDN-deployable, and shouldn't reach for the database. It only
 * spares a signed-out visitor the flash of a loading shell before the
 * client-side gate redirects them.
 *
 * Real enforcement happens in two places that cannot be bypassed:
 *   - every API route, via `requireUser()` (src/lib/session.ts)
 *   - the mounting decision in AppShell (src/components/auth/AppShell.tsx)
 *
 * A forged cookie gets past this and then fails at both, which is the point:
 * this is a UX optimisation, not a security boundary.
 */

const SESSION_COOKIE = 'session_token';

// Must mirror PUBLIC_ROUTES in components/auth/AppShell.tsx. `/help` is public so
// it can be read before signing up.
const PUBLIC_PATHS = ['/login', '/signup', '/help'];

/**
 * Pages that make no sense once you are signed in, so a logged-in visitor is
 * bounced to the app. Deliberately NOT all of PUBLIC_PATHS: /help is public *and*
 * useful when signed in, so it must not redirect.
 */
const AUTH_ONLY_PATHS = ['/login', '/signup'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!hasCookie && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    // Come back here after signing in.
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (hasCookie && AUTH_ONLY_PATHS.includes(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Page routes only. /api is excluded because those return 401 JSON rather than
  // redirecting — a fetch() should get an error it can handle, not an HTML page.
  matcher: ['/((?!api|_next/static|_next/image|icons|favicon.ico|manifest.webmanifest).*)'],
};
