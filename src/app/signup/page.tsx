import { Suspense } from 'react';

import { AuthForm } from '@/components/auth/AuthForm';
import { Spinner } from '@/components/ui/EmptyState';

export const metadata = { title: 'Sign up · Fitness Tracker' };

export default function SignupPage() {
  // See the note in login/page.tsx — useSearchParams() needs this boundary.
  return (
    <Suspense fallback={<Spinner label="Loading" />}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
