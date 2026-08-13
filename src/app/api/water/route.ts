import type { NextRequest } from 'next/server';

import { localDayKey } from '@/lib/calc/dates';
import { getWaterDto } from '@/lib/day';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import {
  RANGES,
  fail,
  handleRoute,
  optionalNumber,
  readJson,
  requireDayKey,
} from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const date = req.nextUrl.searchParams.get('date');
    const dayKey = date ? requireDayKey(date, 'date') : localDayKey();
    return { water: await getWaterDto(user, dayKey) };
  });
}

/**
 * `deltaMl` adjusts (the +1 glass button), `setMl` replaces.
 *
 * The delta path is an atomic increment so rapid taps cannot lose a glass to a
 * read-modify-write race.
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const body = await readJson(req);
    const dayKey = requireDayKey(body.dayKey);
    const deltaMl = optionalNumber(body.deltaMl, 'deltaMl', { min: -20000, max: 20000 });
    const setMl = optionalNumber(body.setMl, 'setMl', RANGES.waterMl);

    if (deltaMl === undefined && setMl === undefined) {
      fail('Provide either deltaMl or setMl');
    }

    const where = { userId_dayKey: { userId: user.id, dayKey } };

    if (setMl !== undefined) {
      await prisma.waterLog.upsert({
        where,
        create: { userId: user.id, dayKey, ml: Math.round(setMl) },
        update: { ml: Math.round(setMl) },
      });
    } else {
      const delta = Math.round(deltaMl as number);
      await prisma.waterLog.upsert({
        where,
        create: { userId: user.id, dayKey, ml: Math.max(0, delta) },
        update: { ml: { increment: delta } },
      });
      // An increment can drive the value negative (repeated "−1 glass" taps);
      // clamp afterwards rather than losing atomicity on the common path.
      const row = await prisma.waterLog.findUnique({ where });
      if (row && row.ml < 0) {
        await prisma.waterLog.update({ where, data: { ml: 0 } });
      }
    }

    return { water: await getWaterDto(user, dayKey) };
  });
}
