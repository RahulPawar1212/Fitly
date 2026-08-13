import type { NextRequest } from 'next/server';

import { localDayKey } from '@/lib/calc/dates';
import { prisma } from '@/lib/db';
import { toProfileDto } from '@/lib/profile';
import { requireUser } from '@/lib/session';
import {
  ACTIVITY_LEVELS,
  GOAL_MODES,
  RANGES,
  SEXES,
  handleRoute,
  nullableNumber,
  optionalEnum,
  optionalNumber,
  optionalString,
  readJson,
} from '@/lib/validate';

// Without this a GET with no dynamic signal can be cached at build time, which
// for a tracker means serving one day's numbers forever.
export const dynamic = 'force-dynamic';

export async function GET() {
  return handleRoute(async () => ({ profile: toProfileDto(await requireUser()) }));
}

export async function PATCH(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const body = await readJson(req);

    const name = optionalString(body.name, 'name', 80);
    const sex = optionalEnum(body.sex, 'sex', SEXES);
    const birthYear = nullableNumber(body.birthYear, 'birthYear', RANGES.birthYear);
    const heightCm = nullableNumber(body.heightCm, 'heightCm', RANGES.heightCm);
    const weightKg = nullableNumber(body.weightKg, 'weightKg', RANGES.weightKg);
    const activityLevel = optionalEnum(
      body.activityLevel,
      'activityLevel',
      ACTIVITY_LEVELS,
    );
    const goalMode = optionalEnum(body.goalMode, 'goalMode', GOAL_MODES);
    const calorieGoalManual = nullableNumber(
      body.calorieGoalManual,
      'calorieGoalManual',
      RANGES.goalKcal,
    );
    const proteinGoalG = nullableNumber(body.proteinGoalG, 'proteinGoalG', RANGES.macroG);
    const carbGoalG = nullableNumber(body.carbGoalG, 'carbGoalG', RANGES.macroG);
    const fatGoalG = nullableNumber(body.fatGoalG, 'fatGoalG', RANGES.macroG);
    const fibreGoalG = nullableNumber(body.fibreGoalG, 'fibreGoalG', RANGES.macroG);
    const waterTargetMl = optionalNumber(
      body.waterTargetMl,
      'waterTargetMl',
      RANGES.waterMl,
    );
    const glassSizeMl = optionalNumber(body.glassSizeMl, 'glassSizeMl', {
      min: 50,
      max: 2000,
    });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(sex !== undefined && { sex }),
        ...(birthYear !== undefined && { birthYear }),
        ...(heightCm !== undefined && { heightCm }),
        ...(weightKg !== undefined && { weightKg }),
        ...(activityLevel !== undefined && { activityLevel }),
        ...(goalMode !== undefined && { goalMode }),
        ...(calorieGoalManual !== undefined && { calorieGoalManual }),
        ...(proteinGoalG !== undefined && { proteinGoalG }),
        ...(carbGoalG !== undefined && { carbGoalG }),
        ...(fatGoalG !== undefined && { fatGoalG }),
        ...(fibreGoalG !== undefined && { fibreGoalG }),
        ...(waterTargetMl !== undefined && { waterTargetMl }),
        ...(glassSizeMl !== undefined && { glassSizeMl }),
      },
    });

    // Keep today's weigh-in in step when the profile weight is edited directly,
    // so the weight chart and the profile never disagree.
    if (weightKg != null) {
      const dayKey = localDayKey();
      await prisma.weightLog.upsert({
        where: { userId_dayKey: { userId: user.id, dayKey } },
        create: { userId: user.id, dayKey, weightKg },
        update: { weightKg },
      });
    }

    return { profile: toProfileDto(updated) };
  });
}
