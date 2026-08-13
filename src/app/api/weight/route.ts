import type { NextRequest } from 'next/server';

import { addDays, localDayKey } from '@/lib/calc/dates';
import { movingAverage, weightChange } from '@/lib/calc/trend';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import {
  RANGES,
  handleRoute,
  optionalBoolean,
  optionalString,
  readJson,
  requireDayKey,
  requireNumber,
} from '@/lib/validate';
import type { WeightTrendDto } from '@/types/dto';

export const dynamic = 'force-dynamic';

const MAX_DAYS = 3650;

export async function GET(req: NextRequest) {
  return handleRoute(async (): Promise<WeightTrendDto> => {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const to = sp.get('to') ? requireDayKey(sp.get('to'), 'to') : localDayKey();
    const from = sp.get('from')
      ? requireDayKey(sp.get('from'), 'from')
      : addDays(to, -(Math.min(MAX_DAYS, Math.max(1, Number(sp.get('days')) || 90)) - 1));

    const rows = await prisma.weightLog.findMany({
      where: { userId: user.id, dayKey: { gte: from, lte: to } },
      orderBy: { dayKey: 'asc' },
    });

    const points = rows.map((r) => ({ dayKey: r.dayKey, value: r.weightKg }));
    const change = weightChange(points);

    return {
      logs: rows.map((r) => ({
        id: r.id,
        dayKey: r.dayKey,
        weightKg: r.weightKg,
        note: r.note,
      })),
      movingAvg7: movingAverage(points, 7).map((p) => ({
        dayKey: p.dayKey,
        kg: Math.round(p.value * 100) / 100,
      })),
      firstKg: change.firstKg,
      lastKg: change.lastKg,
      changeKg: change.changeKg,
      spanDays: change.spanDays,
    };
  });
}

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const body = await readJson(req);
    const dayKey = requireDayKey(body.dayKey);
    const weightKg = requireNumber(body.weightKg, 'weightKg', RANGES.weightKg);
    const note = optionalString(body.note, 'note', 200) ?? null;
    const syncProfile = optionalBoolean(body.syncProfile, 'syncProfile') ?? true;

    const log = await prisma.weightLog.upsert({
      where: { userId_dayKey: { userId: user.id, dayKey } },
      create: { userId: user.id, dayKey, weightKg, note },
      update: { weightKg, note },
    });

    // Only the most recent weigh-in defines "current weight" — back-filling an
    // old day must not change the number used for today's burn calculations.
    if (syncProfile) {
      const latest = await prisma.weightLog.findFirst({
        where: { userId: user.id },
        orderBy: { dayKey: 'desc' },
      });
      if (latest && latest.dayKey === dayKey) {
        await prisma.user.update({ where: { id: user.id }, data: { weightKg } });
      }
    }

    return {
      log: { id: log.id, dayKey: log.dayKey, weightKg: log.weightKg, note: log.note },
    };
  });
}
