/**
 * Idempotent seeder for the SHARED catalogue.
 *
 * Run with `npm run db:seed`. Safe to re-run after every edit to src/data/*:
 *
 *  - Built-in rows are matched by `nameLower` (with `userId: null`) and UPDATED
 *    in place, so correcting a calorie value takes effect immediately.
 *  - Users' own foods and exercises (userId set) are never matched, updated or
 *    deleted — someone may legitimately name a custom food like a built-in.
 *  - Nothing is ever deleted. A naive "clear then insert" reseed would wipe
 *    custom foods and orphan the FoodEntry rows that reference them.
 *  - Per-user usage counters live in FoodUsage/ExerciseUsage, which this never
 *    touches, so a reseed can't disturb anyone's Recent/Frequent lists.
 *
 * Meal slots are NOT seeded here: they are per-user rows, created on signup by
 * `createDefaultMealSlots()` in src/lib/profile.ts.
 *
 * Which database gets seeded depends on the environment: with TURSO_* set in
 * .env it seeds Turso, otherwise the local dev.db. See src/lib/db.ts.
 */
import 'dotenv/config';

import { EXERCISES } from '../src/data/exercises';
import { FOODS } from '../src/data/foods';
import { isRemoteDatabase, prisma } from '../src/lib/db';

const lower = (s: string) => s.trim().toLowerCase();

async function seedFoods() {
  let created = 0;
  let updated = 0;

  for (const food of FOODS) {
    const nameLower = lower(food.name);
    const data = {
      name: food.name,
      nameLower,
      aliases: (food.aliases ?? []).join(','),
      category: food.category,
      cuisine: food.cuisine ?? 'indian',
      servingLabel: food.servingLabel,
      servingGrams: food.servingGrams ?? null,
      kcal: food.kcal,
      proteinG: food.proteinG,
      carbG: food.carbG,
      fatG: food.fatG,
      fibreG: food.fibreG,
      isVeg: food.isVeg ?? true,
    };

    // userId: null identifies the shared catalogue. Matching on it is what keeps
    // the seeder away from anyone's personal foods.
    const existing = await prisma.food.findFirst({
      where: { nameLower, userId: null },
      select: { id: true },
    });

    if (existing) {
      await prisma.food.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.food.create({ data: { ...data, userId: null, isCustom: false } });
      created++;
    }
  }
  return { created, updated };
}

async function seedExercises() {
  let created = 0;
  let updated = 0;

  for (const ex of EXERCISES) {
    const nameLower = lower(ex.name);
    const data = {
      name: ex.name,
      nameLower,
      category: ex.category,
      met: ex.met,
      intensity: ex.intensity ?? null,
    };

    const existing = await prisma.exercise.findFirst({
      where: { nameLower, userId: null },
      select: { id: true },
    });

    if (existing) {
      await prisma.exercise.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.exercise.create({ data: { ...data, userId: null, isCustom: false } });
      created++;
    }
  }
  return { created, updated };
}

async function main() {
  console.log(`Seeding ${isRemoteDatabase ? 'Turso (remote)' : 'local dev.db'}…`);

  const foods = await seedFoods();
  console.log(`  foods      : ${foods.created} created, ${foods.updated} updated`);

  const exercises = await seedExercises();
  console.log(
    `  exercises  : ${exercises.created} created, ${exercises.updated} updated`,
  );

  const [sharedFoods, sharedExercises, users] = await Promise.all([
    prisma.food.count({ where: { userId: null } }),
    prisma.exercise.count({ where: { userId: null } }),
    prisma.user.count(),
  ]);

  console.log(
    `\nDone. Shared catalogue: ${sharedFoods} foods, ${sharedExercises} exercises. ` +
      `${users} ${users === 1 ? 'account' : 'accounts'} registered.`,
  );
  if (users === 0) {
    console.log('Sign up in the app to create your account and meal slots.');
  }
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
