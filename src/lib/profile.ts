import { MEAL_SLOTS } from '@/data/mealSlots';
import { energySummary, resolveMacroTargets, type GoalMode } from '@/lib/calc/energy';
import { prisma } from '@/lib/db';
import type { SessionUser } from '@/lib/session';
import type { ProfileDto } from '@/types/dto';

/**
 * Profile = the settings fields on the User row. There is no separate table:
 * they are per-user settings, so a 1:1 join would buy nothing.
 */

/** Attach the derived energy numbers a client needs but the DB doesn't store. */
export function toProfileDto(u: SessionUser): ProfileDto {
  const energy = energySummary(u);
  const macroTargets = resolveMacroTargets(
    energy.calorieGoal,
    u.weightKg,
    u.goalMode as GoalMode,
    {
      proteinG: u.proteinGoalG,
      carbG: u.carbGoalG,
      fatG: u.fatGoalG,
      fibreG: u.fibreGoalG,
    },
  );

  return {
    id: u.id,
    email: u.email,
    name: u.name,
    sex: u.sex,
    birthYear: u.birthYear,
    heightCm: u.heightCm,
    weightKg: u.weightKg,
    activityLevel: u.activityLevel,
    goalMode: u.goalMode,
    calorieGoalManual: u.calorieGoalManual,
    proteinGoalG: u.proteinGoalG,
    carbGoalG: u.carbGoalG,
    fatGoalG: u.fatGoalG,
    fibreGoalG: u.fibreGoalG,
    waterTargetMl: u.waterTargetMl,
    glassSizeMl: u.glassSizeMl,
    ...energy,
    macroTargets,
  };
}

/**
 * Give a brand-new user their default meal slots.
 *
 * Without this a new account has nowhere to log food — the slots are per-user
 * rows, not a global table, so they can't come from the seeder.
 */
export async function createDefaultMealSlots(userId: string): Promise<void> {
  await prisma.mealSlot.createMany({
    data: MEAL_SLOTS.map((slot) => ({ ...slot, userId })),
  });
}

/**
 * Adopt any custom foods/exercises left over from the single-user era.
 *
 * Only these two models can hold genuinely unowned rows: `userId` is nullable on
 * them (null = shared built-in catalogue), whereas on the entry and log tables it
 * is NOT NULL with a foreign key, so an ownerless row there is impossible by
 * construction. A pre-auth install's custom foods would otherwise sit in the
 * catalogue looking like built-ins, so the first account claims them.
 *
 * Guarded on being the very first user, so a later signup can never adopt
 * somebody else's food.
 *
 * Returns the number of rows adopted.
 */
export async function claimLegacyCustomItems(userId: string): Promise<number> {
  const userCount = await prisma.user.count();
  if (userCount !== 1) return 0;

  const [foods, exercises] = await prisma.$transaction([
    prisma.food.updateMany({
      where: { userId: null, isCustom: true },
      data: { userId },
    }),
    prisma.exercise.updateMany({
      where: { userId: null, isCustom: true },
      data: { userId },
    }),
  ]);

  return foods.count + exercises.count;
}
