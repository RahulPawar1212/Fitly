import type { NextRequest } from 'next/server';

import { addDays, isValidDayKey, localDayKey } from '@/lib/calc/dates';
import { getHistory } from '@/lib/day';
import { requireUser } from '@/lib/session';
import { handleRoute, requireDayKey } from '@/lib/validate';

export const dynamic = 'force-dynamic';

const MAX_DAYS = 366;

export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const toParam = sp.get('to');
    const fromParam = sp.get('from');
    const daysParam = sp.get('days') ?? sp.get('limit');

    const to = toParam ? requireDayKey(toParam, 'to') : localDayKey();
    let from: string;
    if (fromParam) {
      from = requireDayKey(fromParam, 'from');
    } else {
      const days = Math.min(MAX_DAYS, Math.max(1, Number(daysParam) || 30));
      from = addDays(to, -(days - 1));
    }

    if (!isValidDayKey(from) || from > to) {
      return { days: [] };
    }

    return { days: await getHistory(user, from, to) };
  });
}
