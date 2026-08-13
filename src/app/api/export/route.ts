import { NextResponse } from 'next/server';

import { localDayKey } from '@/lib/calc/dates';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Full JSON dump of everything the SIGNED-IN user has entered.
 *
 * Turso's free tier keeps only 1 day of point-in-time recovery, and this
 * database is the user's entire fitness history — so a user-controlled backup
 * matters. Built-in foods and exercises are excluded: they are reproducible from
 * src/data/*, so including them would just bloat the file.
 *
 * Every query is scoped by userId. This endpoint returns a whole account's data
 * in one response, so a missing filter here is the worst possible leak.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'You need to sign in.' }, { status: 401 });
  }
  const userId = user.id;

  const [mealSlots, customFoods, customExercises, foodEntries, exerciseEntries, water, weight] =
    await Promise.all([
      prisma.mealSlot.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
      prisma.food.findMany({ where: { userId, isCustom: true } }),
      prisma.exercise.findMany({ where: { userId, isCustom: true } }),
      prisma.foodEntry.findMany({
        where: { userId },
        orderBy: [{ dayKey: 'asc' }, { loggedAt: 'asc' }],
      }),
      prisma.exerciseEntry.findMany({
        where: { userId },
        orderBy: [{ dayKey: 'asc' }, { loggedAt: 'asc' }],
      }),
      prisma.waterLog.findMany({ where: { userId }, orderBy: { dayKey: 'asc' } }),
      prisma.weightLog.findMany({ where: { userId }, orderBy: { dayKey: 'asc' } }),
    ]);

  // Never include passwordHash in an export the user might share or email.
  // Built explicitly rather than by destructuring-and-spreading, so a field
  // added to User later can't silently leak into the file.
  const profile = {
    id: user.id,
    email: user.email,
    name: user.name,
    sex: user.sex,
    birthYear: user.birthYear,
    heightCm: user.heightCm,
    weightKg: user.weightKg,
    activityLevel: user.activityLevel,
    goalMode: user.goalMode,
    calorieGoalManual: user.calorieGoalManual,
    proteinGoalG: user.proteinGoalG,
    carbGoalG: user.carbGoalG,
    fatGoalG: user.fatGoalG,
    fibreGoalG: user.fibreGoalG,
    waterTargetMl: user.waterTargetMl,
    glassSizeMl: user.glassSizeMl,
    createdAt: user.createdAt,
  };

  const payload = {
    format: 'fitness-tracker-export',
    version: 2,
    exportedAt: new Date().toISOString(),
    profile,
    mealSlots,
    customFoods,
    customExercises,
    foodEntries,
    exerciseEntries,
    waterLogs: water,
    weightLogs: weight,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="fitness-backup-${localDayKey()}.json"`,
    },
  });
}
