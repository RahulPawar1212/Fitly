import type { NextRequest } from 'next/server';

import { localDayKey } from '@/lib/calc/dates';
import { getDay } from '@/lib/day';
import { requireUser } from '@/lib/session';
import { handleRoute, requireDayKey } from '@/lib/validate';

export const dynamic = 'force-dynamic';

/**
 * The one-shot day payload: meal slots, entries, exercise, water, weight and
 * totals in a single request. This is what the Today and Diary screens load.
 */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const date = req.nextUrl.searchParams.get('date');
    // Falling back to the server's today is a convenience for curl; the client
    // always sends its own local day.
    const dayKey = date ? requireDayKey(date, 'date') : localDayKey();
    return getDay(user, dayKey);
  });
}
