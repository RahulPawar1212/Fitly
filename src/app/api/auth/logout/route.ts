import { NextResponse } from 'next/server';

import { SESSION_COOKIE } from '@/lib/auth';
import { destroyCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  // Delete the row, not just the cookie — otherwise a copied token stays valid
  // for its full 30 days.
  await destroyCurrentSession();

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
