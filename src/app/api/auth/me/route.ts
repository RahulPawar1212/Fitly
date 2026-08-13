import { NextResponse } from 'next/server';

import { toProfileDto } from '@/lib/profile';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Who am I? Returns `{ user: null }` rather than a 401 when signed out — the
 * client calls this on boot to decide whether to show the app or the login page,
 * and "not signed in" is a normal answer there, not an error.
 */
export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user: user ? toProfileDto(user) : null });
}
