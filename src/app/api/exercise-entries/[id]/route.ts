import type { NextRequest } from 'next/server';

import { metBurnKcal } from '@/lib/calc/burn';
import { getDayTotals, toExerciseEntryDto } from '@/lib/day';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import {
  RANGES,
  fail,
  handleRoute,
  optionalNumber,
  optionalString,
  readJson,
  requireDayKey,
} from '@/lib/validate';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handleRoute(async () => {
    const user = await requireUser();
    const existing = await prisma.exerciseEntry.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) fail('Entry not found', 404);

    const body = await readJson(req);
    const minutes = optionalNumber(body.minutes, 'minutes', RANGES.minutes);
    const dayKey = body.dayKey === undefined ? undefined : requireDayKey(body.dayKey);
    const note =
      body.note === undefined ? undefined : optionalString(body.note, 'note', 200) ?? null;

    // Recompute from the SNAPSHOT MET and snapshot weight, not from the current
    // exercise row or the current profile — editing the duration of a workout
    // from two months ago must not re-price it at today's body weight.
    const nextMinutes = minutes ?? existing.minutes;
    const kcalBurned = metBurnKcal(
      existing.metSnapshot,
      existing.bodyWeightKgSnapshot,
      nextMinutes,
    );

    const entry = await prisma.exerciseEntry.update({
      where: { id },
      data: {
        ...(minutes !== undefined && { minutes }),
        ...(dayKey !== undefined && { dayKey }),
        ...(note !== undefined && { note }),
        kcalBurned,
      },
    });

    const movedFrom =
      dayKey !== undefined && dayKey !== existing.dayKey ? existing.dayKey : null;

    return {
      entry: toExerciseEntryDto(entry),
      totals: await getDayTotals(user, entry.dayKey),
      ...(movedFrom && { previousDayTotals: await getDayTotals(user, movedFrom) }),
    };
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handleRoute(async () => {
    const user = await requireUser();
    const existing = await prisma.exerciseEntry.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) fail('Entry not found', 404);

    await prisma.exerciseEntry.delete({ where: { id } });
    return { ok: true as const, totals: await getDayTotals(user, existing.dayKey) };
  });
}
