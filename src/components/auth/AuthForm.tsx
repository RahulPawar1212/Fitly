'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { login, signup } from '@/lib/api';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth-constants';

/**
 * Shared sign-in / sign-up form.
 *
 * One component for both so the two screens can't drift apart in styling or
 * validation behaviour.
 */
export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();

  // `?next=` is set by src/proxy.ts when it bounces a deep link. Only relative
  // paths are honoured, so this can't be turned into an open redirect.
  const nextParam = searchParams.get('next');
  const redirectTo =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setError(null);

    // Check locally first so an obvious mistake doesn't need a round trip.
    if (!email.includes('@')) {
      setError('Enter a valid email address');
      return;
    }
    if (isSignup && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setBusy(true);
    try {
      const user = isSignup
        ? await signup({ email, password, name: name.trim() || undefined })
        : await login({ email, password });
      setUser(user);
      // replace, not push — the back button shouldn't return to the login form.
      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500 text-3xl">
          🍛
        </div>
        {/* The app's name, so the login screen identifies itself. */}
        <p className="text-lg font-bold tracking-tight text-brand-600 dark:text-brand-400">
          Fitlyfy
        </p>
        <h1 className="mt-2 text-2xl font-semibold">
          {isSignup ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isSignup
            ? 'Track Indian meals in rotis and katoris, not grams.'
            : 'Sign in to keep tracking.'}
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {isSignup && (
          <Field label="Your name (optional)">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Rahul"
              className={inputClass}
            />
          </Field>
        )}

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="email"
            required
            placeholder="you@example.com"
            className={inputClass}
          />
        </Field>

        <Field
          label="Password"
          hint={isSignup ? `At least ${MIN_PASSWORD_LENGTH} characters` : undefined}
        >
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              // Tells password managers whether to offer a new or saved password.
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
              className={`${inputClass} pr-16`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </Field>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 min-h-14 w-full rounded-xl bg-brand-500 text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-50"
        >
          {busy
            ? isSignup
              ? 'Creating account…'
              : 'Signing in…'
            : isSignup
              ? 'Create account'
              : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        {isSignup ? 'Already have an account? ' : "Don't have an account? "}
        <Link
          href={isSignup ? '/login' : '/signup'}
          className="font-semibold text-brand-600 dark:text-brand-400"
        >
          {isSignup ? 'Sign in' : 'Sign up'}
        </Link>
      </p>
    </div>
  );
}

const inputClass =
  'h-12 w-full rounded-xl border border-slate-300 px-3 text-base dark:border-slate-700 dark:bg-slate-800';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
