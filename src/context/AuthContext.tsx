'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { setUnauthorizedHandler } from '@/lib/api';
import type { ProfileDto } from '@/types/dto';

/**
 * Who is signed in.
 *
 * Boots by asking `/api/auth/me` — the session lives in an httpOnly cookie, so
 * the client cannot read it directly and must ask the server.
 */

interface AuthContextValue {
  user: ProfileDto | null;
  /** True until the first /me response lands. */
  loading: boolean;
  setUser: (user: ProfileDto | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<ProfileDto | null>(null);
  const [loading, setLoading] = useState(true);

  /** Ask the server who we are. The session cookie is httpOnly, so we must. */
  const fetchMe = useCallback(async (): Promise<ProfileDto | null> => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = (await res.json()) as { user: ProfileDto | null };
      return data.user;
    } catch {
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    const next = await fetchMe();
    setUser(next);
    setLoading(false);
  }, [fetchMe]);

  // Boot. Every state update happens after an await, so nothing is set
  // synchronously in the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchMe();
      if (cancelled) return;
      setUser(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMe]);

  // Any 401 from anywhere in the app means the session expired or was revoked.
  // Registering one handler here beats sprinkling redirect logic through every
  // caller. The callback is deferred to a microtask so it never runs setState
  // synchronously inside a render or effect body.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void Promise.resolve().then(() => {
        setUser(null);
        router.replace('/login');
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      router.replace('/login');
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, setUser, refresh, logout }),
    [user, loading, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
