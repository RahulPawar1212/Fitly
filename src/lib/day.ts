import { metBurnKcalPerMinute } from '@/lib/calc/burn';
import { addDays, localDayKey } from '@/lib/calc/dates';
import {
  dayTotals,
  scaleServing,
  totalsByMealSlot,
  type Nutrition,
} from '@/lib/calc/nutrition';
import { prisma } from '@/lib/db';
import { toProfileDto } from '@/lib/profile';
import type { SessionUser } from '@/lib/session';
import type {
  DayDto,
  ExerciseDto,
  ExerciseEntryDto,
  FoodDto,
  FoodEntryDto,
  HistoryDayDto,
  MealSlotDto,
  WaterDto,
} from '@/types/dto';

/**
 * Server-side day aggregation.
 *
 * `getDay` is the single query path behind `GET /api/day` — one round trip for
 * everything a day screen shows.
 *
 * Every query here is scoped by `userId`. That is not optional: these are the
 * functions behind the screens, so a missing filter would show one person another
 * person's food.
 */

/** Per-user usage counters, joined in from Food/ExerciseUsage. */
export interface UsageStats {
  usageCount: number;
  lastUsedAt: Date | null;
}

type FoodRow = {
  id: string;
  name: string;
  aliases: string;
  category: string;
  cuisine: string;
  servingLabel: string;
  servingGrams: number | null;
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fibreG: number;
  isVeg: boolean;
  isCustom: boolean;
};

export function toFoodDto(f: FoodRow, usage?: UsageStats): FoodDto {
  return {
    id: f.id,
    name: f.name,
    aliases: f.aliases,
    category: f.category,
    cuisine: f.cuisine,
    servingLabel: f.servingLabel,
    servingGrams: f.servingGrams,
    kcal: f.kcal,
    proteinG: f.proteinG,
    carbG: f.carbG,
    fatG: f.fatG,
    fibreG: f.fibreG,
    isVeg: f.isVeg,
    isCustom: f.isCustom,
    usageCount: usage?.usageCount ?? 0,
    lastUsedAt: usage?.lastUsedAt?.toISOString() ?? null,
  };
}

type ExerciseRow = {
  id: string;
  name: string;
  category: string;
  met: number;
  intensity: string | null;
  isCustom: boolean;
};

export function toExerciseDto(
  e: ExerciseRow,
  bodyWeightKg: number | null,
  usage?: UsageStats,
): ExerciseDto {
  return {
    id: e.id,
    name: e.name,
    category: e.category,
    met: e.met,
    intensity: e.intensity,
    isCustom: e.isCustom,
    usageCount: usage?.usageCount ?? 0,
    lastUsedAt: usage?.lastUsedAt?.toISOString() ?? null,
    kcalPerMinuteAtCurrentWeight:
      bodyWeightKg != null ? metBurnKcalPerMinute(e.met, bodyWeightKg) : null,
  };
}

type FoodEntryRow = {
  id: string;
  dayKey: string;
  mealSlotId: string;
  foodId: string | null;
  servings: number;
  nameSnapshot: string;
  servingLabelSnapshot: string;
  kcalPerServing: number;
  proteinPerServing: number;
  carbPerServing: number;
  fatPerServing: number;
  fibrePerServing: number;
  note: string | null;
  loggedAt: Date;
};

export function toFoodEntryDto(e: FoodEntryRow): FoodEntryDto {
  return {
    id: e.id,
    dayKey: e.dayKey,
    mealSlotId: e.mealSlotId,
    foodId: e.foodId,
    servings: e.servings,
    name: e.nameSnapshot,
    servingLabel: e.servingLabelSnapshot,
    kcalPerServing: e.kcalPerServing,
    proteinPerServing: e.proteinPerServing,
    carbPerServing: e.carbPerServing,
    fatPerServing: e.fatPerServing,
    fibrePerServing: e.fibrePerServing,
    total: scaleServing(e, e.servings),
    note: e.note,
    loggedAt: e.loggedAt.toISOString(),
  };
}

type ExerciseEntryRow = {
  id: string;
  dayKey: string;
  exerciseId: string | null;
  minutes: number;
  nameSnapshot: string;
  metSnapshot: number;
  bodyWeightKgSnapshot: number;
  kcalBurned: number;
  note: string | null;
  loggedAt: Date;
};

export function toExerciseEntryDto(e: ExerciseEntryRow): ExerciseEntryDto {
  return {
    id: e.id,
    dayKey: e.dayKey,
    exerciseId: e.exerciseId,
    minutes: e.minutes,
    name: e.nameSnapshot,
    met: e.metSnapshot,
    bodyWeightKg: e.bodyWeightKgSnapshot,
    kcalBurned: e.kcalBurned,
    note: e.note,
    loggedAt: e.loggedAt.toISOString(),
  };
}

export function toMealSlotDto(s: {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}): MealSlotDto {
  return {
    id: s.id,
    key: s.key,
    name: s.name,
    sortOrder: s.sortOrder,
    isActive: s.isActive,
  };
}

function buildWaterDto(
  dayKey: string,
  ml: number,
  targetMl: number,
  glassSizeMl: number,
): WaterDto {
  const size = glassSizeMl > 0 ? glassSizeMl : 250;
  return {
    dayKey,
    ml,
    targetMl,
    glassSizeMl: size,
    glasses: Math.round((ml / size) * 10) / 10,
    targetGlasses: Math.round(targetMl / size),
  };
}

export async function getWaterDto(
  user: SessionUser,
  dayKey: string,
): Promise<WaterDto> {
  const row = await prisma.waterLog.findUnique({
    where: { userId_dayKey: { userId: user.id, dayKey } },
  });
  return buildWaterDto(dayKey, row?.ml ?? 0, user.waterTargetMl, user.glassSizeMl);
}

/** Everything one day screen needs, in a single pass. */
export async function getDay(user: SessionUser, dayKey: string): Promise<DayDto> {
  const profileDto = toProfileDto(user);
  const userId = user.id;

  const [slots, foodEntries, exerciseEntries, water, weight] = await Promise.all([
    prisma.mealSlot.findMany({
      where: { userId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.foodEntry.findMany({
      where: { userId, dayKey },
      orderBy: [{ loggedAt: 'asc' }],
    }),
    prisma.exerciseEntry.findMany({
      where: { userId, dayKey },
      orderBy: [{ loggedAt: 'asc' }],
    }),
    prisma.waterLog.findUnique({ where: { userId_dayKey: { userId, dayKey } } }),
    prisma.weightLog.findUnique({ where: { userId_dayKey: { userId, dayKey } } }),
  ]);

  const entriesBySlot: Record<string, FoodEntryDto[]> = {};
  for (const slot of slots) entriesBySlot[slot.id] = [];
  for (const entry of foodEntries) {
    // A slot that was deactivated after entries were logged against it still
    // needs a bucket, or its calories would vanish from the day view.
    (entriesBySlot[entry.mealSlotId] ??= []).push(toFoodEntryDto(entry));
  }

  const slotTotals: Record<string, Nutrition> = {};
  for (const [slotId, totals] of totalsByMealSlot(foodEntries)) {
    slotTotals[slotId] = totals;
  }

  return {
    dayKey,
    mealSlots: slots.map(toMealSlotDto),
    entriesBySlot,
    exerciseEntries: exerciseEntries.map(toExerciseEntryDto),
    water: buildWaterDto(dayKey, water?.ml ?? 0, user.waterTargetMl, user.glassSizeMl),
    weightKg: weight?.weightKg ?? null,
    totals: dayTotals(foodEntries, exerciseEntries, profileDto.calorieGoal),
    goalKcal: profileDto.calorieGoal,
    macroTargets: profileDto.macroTargets,
    slotTotals,
  };
}

/** Recompute just the totals — the cheap response after a mutation. */
export async function getDayTotals(user: SessionUser, dayKey: string) {
  const [foodEntries, exerciseEntries] = await Promise.all([
    prisma.foodEntry.findMany({ where: { userId: user.id, dayKey } }),
    prisma.exerciseEntry.findMany({ where: { userId: user.id, dayKey } }),
  ]);
  return dayTotals(foodEntries, exerciseEntries, toProfileDto(user).calorieGoal);
}

/**
 * Per-day rollups for the history list.
 *
 * Uses one grouped query per table rather than N day queries, then merges in
 * memory — a month of history is 4 queries regardless of how much is logged.
 */
export async function getHistory(
  user: SessionUser,
  from: string,
  to: string,
): Promise<HistoryDayDto[]> {
  const userId = user.id;
  const goalKcal = toProfileDto(user).calorieGoal;
  const range = { gte: from, lte: to };

  const [foodEntries, exerciseGroups, waterRows, weightRows] = await Promise.all([
    // Food needs the raw rows: totals are servings × snapshot, which SQL
    // grouping can't express without a generated column.
    prisma.foodEntry.findMany({ where: { userId, dayKey: range } }),
    prisma.exerciseEntry.groupBy({
      by: ['dayKey'],
      where: { userId, dayKey: range },
      _sum: { kcalBurned: true, minutes: true },
      _count: { _all: true },
    }),
    prisma.waterLog.findMany({ where: { userId, dayKey: range } }),
    prisma.weightLog.findMany({ where: { userId, dayKey: range } }),
  ]);

  const byDay = new Map<string, HistoryDayDto>();
  const blank = (dayKey: string): HistoryDayDto => ({
    dayKey,
    kcalIn: 0,
    kcalOut: 0,
    net: 0,
    goalKcal,
    proteinG: 0,
    carbG: 0,
    fatG: 0,
    fibreG: 0,
    entryCount: 0,
    exerciseCount: 0,
    exerciseMinutes: 0,
    waterMl: 0,
    weightKg: null,
  });
  const get = (dayKey: string) => {
    let row = byDay.get(dayKey);
    if (!row) byDay.set(dayKey, (row = blank(dayKey)));
    return row;
  };

  for (const e of foodEntries) {
    const row = get(e.dayKey);
    const n = scaleServing(e, e.servings);
    row.kcalIn += n.kcal;
    row.proteinG += n.proteinG;
    row.carbG += n.carbG;
    row.fatG += n.fatG;
    row.fibreG += n.fibreG;
    row.entryCount += 1;
  }

  for (const g of exerciseGroups) {
    const row = get(g.dayKey);
    row.kcalOut = g._sum.kcalBurned ?? 0;
    row.exerciseMinutes = g._sum.minutes ?? 0;
    row.exerciseCount = g._count._all;
  }

  for (const w of waterRows) get(w.dayKey).waterMl = w.ml;
  for (const w of weightRows) get(w.dayKey).weightKg = w.weightKg;

  for (const row of byDay.values()) row.net = row.kcalIn - row.kcalOut;

  // Newest first — history reads backwards from today.
  return [...byDay.values()].sort((a, b) => b.dayKey.localeCompare(a.dayKey));
}

/** Default history window: `days` days ending today. */
export function defaultHistoryRange(days = 30, to: string = localDayKey()) {
  return { from: addDays(to, -(days - 1)), to };
}

// --------------------------------------------------------------- usage counters

/**
 * Bump this user's usage counter for a food, inside the caller's transaction.
 *
 * Counters live in FoodUsage, not on Food, because built-in foods are shared —
 * a counter on the row itself would let one person's logging reorder everyone
 * else's Recent list.
 */
export async function bumpFoodUsage(
  tx: Pick<typeof prisma, 'foodUsage'>,
  userId: string,
  foodId: string,
): Promise<void> {
  await tx.foodUsage.upsert({
    where: { userId_foodId: { userId, foodId } },
    create: { userId, foodId, usageCount: 1, lastUsedAt: new Date() },
    update: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
  });
}

export async function bumpExerciseUsage(
  tx: Pick<typeof prisma, 'exerciseUsage'>,
  userId: string,
  exerciseId: string,
): Promise<void> {
  await tx.exerciseUsage.upsert({
    where: { userId_exerciseId: { userId, exerciseId } },
    create: { userId, exerciseId, usageCount: 1, lastUsedAt: new Date() },
    update: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
  });
}

/** Look up this user's usage rows for a set of foods, keyed by foodId. */
export async function foodUsageMap(
  userId: string,
  foodIds: string[],
): Promise<Map<string, UsageStats>> {
  if (foodIds.length === 0) return new Map();
  const rows = await prisma.foodUsage.findMany({
    where: { userId, foodId: { in: foodIds } },
  });
  return new Map(
    rows.map((r) => [r.foodId, { usageCount: r.usageCount, lastUsedAt: r.lastUsedAt }]),
  );
}

export async function exerciseUsageMap(
  userId: string,
  exerciseIds: string[],
): Promise<Map<string, UsageStats>> {
  if (exerciseIds.length === 0) return new Map();
  const rows = await prisma.exerciseUsage.findMany({
    where: { userId, exerciseId: { in: exerciseIds } },
  });
  return new Map(
    rows.map((r) => [
      r.exerciseId,
      { usageCount: r.usageCount, lastUsedAt: r.lastUsedAt },
    ]),
  );
}

/**
 * Rows visible to this user: the shared catalogue plus their own.
 *
 * Returned under `AND` rather than as a bare `OR`, deliberately. A bare
 * `{ OR: [...] }` is destroyed the moment a caller spreads it alongside its own
 * `OR` (`{...visibleToUser(id), OR: [...search...]}` keeps only the second one) —
 * which silently leaks every other user's custom foods into search results.
 * Nesting under AND makes the filter impossible to clobber by accident.
 */
export function visibleToUser(userId: string) {
  return { AND: [{ OR: [{ userId: null }, { userId }] }] };
}
