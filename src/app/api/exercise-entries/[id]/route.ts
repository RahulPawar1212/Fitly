import type { NextRequest } from 'next/server';

import { metBurnKcal } from '@/lib/calc/burn';
import { MAX_STEPS, MIN_STEPS, formatSteps, stepEntry } from '@/lib/calc/steps';
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
    const steps = optionalNumber(body.steps, 'steps', {
      min: MIN_STEPS,
      max: MAX_STEPS,
    });
    const dayKey = body.dayKey === undefined ? undefined : requireDayKey(body.dayKey);
    const note =
      body.note === undefined ? undefined : optionalString(body.note, 'note', 200) ?? null;

    // Correcting the step count on a walk — the "I left it running by mistake"
    // case — has to redo the whole derivation: distance, pace and burn all follow
    // from the count. Snapshot weight is reused, not today's, so an old entry is
    // never silently re-priced.
    const isStepEntry = existing.steps != null;
    let derivedFields: Record<string, unknown> = {};
    let kcalBurned: number;

    if (isStepEntry && (steps !== undefined || minutes !== undefined)) {
      const nextSteps = steps ?? existing.steps ?? 0;
      // A previously estimated duration stays estimated unless one is supplied.
      const nextMinutes =
        minutes ?? (existing.minutesEstimated ? undefined : existing.minutes);

      const derived = stepEntry(
        nextSteps,
        // Height only affects stride; using the current value is fine and keeps
        // this simple. Weight is what must not drift, and that is snapshotted.
        user.heightCm,
        existing.bodyWeightKgSnapshot,
        nextMinutes,
      );

      kcalBurned = derived.kcalBurned;
      derivedFields = {
        steps: nextSteps,
        minutes: derived.minutes,
        distanceKm: derived.distanceKm,
        minutesEstimated: derived.minutesEstimated,
        metSnapshot: derived.met,
        nameSnapshot: `Walking — ${formatSteps(nextSteps)} steps`,
      };
    } else {
      // Recompute from the SNAPSHOT MET and snapshot weight, not from the current
      // exercise row or the current profile — editing the duration of a workout
      // from two months ago must not re-price it at today's body weight.
      const nextMinutes = minutes ?? existing.minutes;
      kcalBurned = metBurnKcal(
        existing.metSnapshot,
        existing.bodyWeightKgSnapshot,
        nextMinutes,
      );
      if (minutes !== undefined) derivedFields = { minutes };
    }

    const entry = await prisma.exerciseEntry.update({
      where: { id },
      data: {
        ...derivedFields,
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
