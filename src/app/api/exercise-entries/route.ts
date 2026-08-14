import type { NextRequest } from 'next/server';

import { metBurnKcal } from '@/lib/calc/burn';
import { MAX_STEPS, MIN_STEPS, formatSteps, stepEntry } from '@/lib/calc/steps';
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

/**
 * Log a workout, in one of two shapes:
 *
 *   { minutes, exerciseId }  — the usual: an activity and a duration.
 *   { steps, minutes? }      — a walk as a step count, from a phone health app or
 *                              a band. Distance, pace and burn are derived, and
 *                              `minutes` is optional (estimated from cadence when
 *                              absent, and flagged as an estimate).
 */
export async function POST(req: NextRequest) {
  return handleCreate(async () => {
    const user = await requireUser();
    const body = await readJson(req);
    const dayKey = requireDayKey(body.dayKey);
    const note = optionalString(body.note, 'note', 200) ?? null;
    const exerciseId =
      typeof body.exerciseId === 'string' && body.exerciseId ? body.exerciseId : null;

    // A step count switches the whole entry to the steps path.
    const isStepEntry = body.steps !== undefined && body.steps !== null;

    // Burn is a function of body weight, so we cannot compute anything without
    // one. Say so plainly rather than silently logging 0 kcal.
    const bodyWeightKg =
      optionalNumber(body.bodyWeightKg, 'bodyWeightKg', RANGES.weightKg) ??
      user.weightKg;
    if (bodyWeightKg == null) {
      fail('Set your weight in Profile first — calorie burn depends on it.', 409);
    }

    let minutes: number;
    let nameSnapshot: string;
    let metSnapshot: number;
    let steps: number | null = null;
    let distanceKm: number | null = null;
    let minutesEstimated = false;

    if (isStepEntry) {
      steps = requireNumber(body.steps, 'steps', {
        min: MIN_STEPS,
        max: MAX_STEPS,
      });
      // Duration is optional here: health apps report a step total for the day
      // with no notion of how long it took.
      const givenMinutes = optionalNumber(body.minutes, 'minutes', RANGES.minutes);

      const derived = stepEntry(steps, user.heightCm, bodyWeightKg, givenMinutes);
      minutes = derived.minutes;
      minutesEstimated = derived.minutesEstimated;
      distanceKm = derived.distanceKm;
      metSnapshot = derived.met;
      nameSnapshot =
        optionalString(body.name, 'name', 120) ??
        `Walking — ${formatSteps(steps)} steps`;
    } else {
      minutes = requireNumber(body.minutes, 'minutes', RANGES.minutes);

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
    }

    const kcalBurned = metBurnKcal(metSnapshot, bodyWeightKg, minutes);

    const entry = await prisma.$transaction(async (tx) => {
      const row = await tx.exerciseEntry.create({
        data: {
          userId: user.id,
          dayKey,
          // A step entry isn't tied to a catalogue row, so it has no exerciseId
          // and nothing to bump usage on.
          exerciseId: isStepEntry ? null : exerciseId,
          minutes,
          steps,
          distanceKm,
          minutesEstimated,
          nameSnapshot,
          metSnapshot,
          bodyWeightKgSnapshot: bodyWeightKg,
          kcalBurned,
          note,
        },
      });
      if (!isStepEntry && exerciseId) await bumpExerciseUsage(tx, user.id, exerciseId);
      return row;
    });

    return {
      entry: toExerciseEntryDto(entry),
      totals: await getDayTotals(user, dayKey),
    };
  });
}
