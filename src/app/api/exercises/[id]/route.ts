import type { NextRequest } from 'next/server';

import { EXERCISE_CATEGORIES, type ExerciseCategory } from '@/data/types';
import { metIntensity } from '@/lib/calc/burn';
import { toExerciseDto } from '@/lib/day';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import {
  RANGES,
  fail,
  handleRoute,
  optionalNumber,
  optionalString,
  readJson,
  toNameLower,
} from '@/lib/validate';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handleRoute(async () => {
    const user = await requireUser();
    const existing = await prisma.exercise.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      const shared = await prisma.exercise.findFirst({ where: { id, userId: null } });
      if (shared) {
        fail(
          'Built-in exercises cannot be edited. Create your own version instead.',
          403,
        );
      }
      fail('Exercise not found', 404);
    }

    const body = await readJson(req);
    const name = optionalString(body.name, 'name', 120);
    const met = optionalNumber(body.met, 'met', RANGES.met);
    const category = optionalString(body.category, 'category', 40);
    const intensity = optionalString(body.intensity, 'intensity', 20);

    const exercise = await prisma.exercise.update({
      where: { id },
      data: {
        // Renaming must recompute nameLower or search stops finding the row.
        ...(name !== undefined && { name, nameLower: toNameLower(name) }),
        // Changing the MET re-derives the intensity band, unless the caller
        // states one — otherwise a raised MET keeps a stale "light" label.
        ...(met !== undefined && {
          met,
          ...(intensity === undefined && { intensity: metIntensity(met) }),
        }),
        ...(category !== undefined &&
          EXERCISE_CATEGORIES.includes(category as ExerciseCategory) && { category }),
        ...(intensity !== undefined && { intensity }),
      },
    });

    return { exercise: toExerciseDto(exercise, user.weightKg) };
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handleRoute(async () => {
    const user = await requireUser();
    const existing = await prisma.exercise.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      const shared = await prisma.exercise.findFirst({ where: { id, userId: null } });
      if (shared) fail('Built-in exercises cannot be deleted.', 403);
      fail('Exercise not found', 404);
    }

    const referenced = await prisma.exerciseEntry.count({ where: { exerciseId: id } });
    if (referenced > 0) {
      await prisma.exercise.update({ where: { id }, data: { isArchived: true } });
      return { ok: true as const, archived: true };
    }

    await prisma.exercise.delete({ where: { id } });
    return { ok: true as const, archived: false };
  });
}
