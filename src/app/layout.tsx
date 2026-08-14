import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/auth/AppShell';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider } from '@/context/AuthContext';

import './globals.css';

export const metadata: Metadata = {
  title: 'Fitzora',
  description: 'Indian calorie and fitness tracker — meals, exercise, weight and water.',
  manifest: '/manifest.webmanifest',
  // `title` here is the label under the icon once added to a phone's home screen.
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Fitzora' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Locking zoom keeps the fixed bottom nav where the thumb expects it; the
  // layout is already sized for small screens so pinch-zoom isn't needed.
  maximumScale: 1,
  // Lets the layout extend under the notch / home bar, which we then pad for
  // with env(safe-area-inset-*).
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      {/* Nav clearance is applied by AppShell, not here — the login screen has
          no bottom nav and shouldn't reserve space for one. */}
      <body className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <ToastProvider>
          {/* AuthProvider wraps AppShell, which decides between the app and the
              login page — and crucially controls whether DayProvider mounts. */}
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
