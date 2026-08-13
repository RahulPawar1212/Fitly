import type { NextRequest } from 'next/server';

import { metBurnKcal } from '@/lib/calc/burn';
import {
  bumpExerciseUsage,
  getDayTotals,
  toExerciseEntryDto,
  visibleToUser,
} from '@/lib/day';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import {
  RANGES,
  fail,
  handleCreate,
  handleRoute,
  optionalNumber,
  optionalString,
  readJson,
  requireDayKey,
  requireNumber,
  requireString,
} from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const dayKey = requireDayKey(req.nextUrl.searchParams.get('date'), 'date');
    const entries = await prisma.exerciseEntry.findMany({
      where: { userId: user.id, dayKey },
      orderBy: { loggedAt: 'asc' },
    });
    return { entries: entries.map(toExerciseEntryDto) };
  });
}

export async function POST(req: NextRequest) {
  return handleCreate(async () => {
    const user = await requireUser();
    const body = await readJson(req);
    const dayKey = requireDayKey(body.dayKey);
    const minutes = requireNumber(body.minutes, 'minutes', RANGES.minutes);
    const note = optionalString(body.note, 'note', 200) ?? null;
    const exerciseId =
      typeof body.exerciseId === 'string' && body.exerciseId ? body.exerciseId : null;

    // Burn is a function of body weight, so we cannot compute anything without
    // one. Say so plainly rather than silently logging 0 kcal.
    const bodyWeightKg =
      optionalNumber(body.bodyWeightKg, 'bodyWeightKg', RANGES.weightKg) ??
      user.weightKg;
    if (bodyWeightKg == null) {
      fail('Set your weight in Profile first — calorie burn depends on it.', 409);
    }

    let nameSnapshot: string;
    let metSnapshot: number;

    if (exerciseId) {
      const exercise = await prisma.exercise.findFirst({
        where: { id: exerciseId, ...visibleToUser(user.id) },
      });
      if (!exercise) fail('Exercise not found', 404);
      nameSnapshot = exercise.name;
      metSnapshot = exercise.met;
    } else {
      nameSnapshot = requireString(body.name, 'name', 120);
      metSnapshot = requireNumber(body.met, 'met', RANGES.met);
    }

    const kcalBurned = metBurnKcal(metSnapshot, bodyWeightKg, minutes);

    const entry = await prisma.$transaction(async (tx) => {
      const row = await tx.exerciseEntry.create({
        data: {
          userId: user.id,
          dayKey,
          exerciseId,
          minutes,
          nameSnapshot,
          metSnapshot,
          bodyWeightKgSnapshot: bodyWeightKg,
          kcalBurned,
          note,
        },
      });
      if (exerciseId) await bumpExerciseUsage(tx, user.id, exerciseId);
      return row;
    });

    return {
      entry: toExerciseEntryDto(entry),
      totals: await getDayTotals(user, dayKey),
    };
  });
}
