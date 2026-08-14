import { Suspense } from 'react';

import { AuthForm } from '@/components/auth/AuthForm';
import { Spinner } from '@/components/ui/EmptyState';

export const metadata = { title: 'Sign in · Fitzora' };

export default function LoginPage() {
  // AuthForm reads `?next=` with useSearchParams(), which forces a client-side
  // bailout — Next requires a Suspense boundary around it or the page cannot be
  // prerendered at build time.
  return (
    <Suspense fallback={<Spinner label="Loading" />}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
