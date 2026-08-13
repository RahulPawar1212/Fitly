import type { NextRequest } from 'next/server';

import { bumpFoodUsage, getDayTotals, toFoodEntryDto, visibleToUser } from '@/lib/day';
import { prisma } from '@/lib/db';
import { requireUser, type SessionUser } from '@/lib/session';
import {
  RANGES,
  fail,
  handleCreate,
  handleRoute,
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
    const entries = await prisma.foodEntry.findMany({
      where: { userId: user.id, dayKey },
      orderBy: { loggedAt: 'asc' },
    });
    return { entries: entries.map(toFoodEntryDto) };
  });
}

/** One logged item, before it becomes a row. */
interface PreparedEntry {
  userId: string;
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
}

/**
 * Resolve one item into a full snapshot.
 *
 * With a `foodId`, the nutrition is read from the Food row SERVER-SIDE — the
 * client cannot invent calorie numbers for a food that exists. Without one, the
 * caller is logging something ad hoc and must supply every field.
 */
async function prepareItem(
  item: Record<string, unknown>,
  user: SessionUser,
  dayKey: string,
  mealSlotId: string,
): Promise<PreparedEntry> {
  const servings = requireNumber(item.servings ?? 1, 'servings', RANGES.servings);
  const note = optionalString(item.note, 'note', 200) ?? null;
  const foodId = typeof item.foodId === 'string' && item.foodId ? item.foodId : null;

  const base = {
    userId: user.id,
    dayKey,
    mealSlotId,
    servings,
    note,
  };

  if (foodId) {
    // Only the shared catalogue or this user's own foods — never another
    // person's custom food.
    const food = await prisma.food.findFirst({
      where: { id: foodId, ...visibleToUser(user.id) },
    });
    if (!food) fail('Food not found', 404);
    return {
      ...base,
      foodId,
      nameSnapshot: food.name,
      servingLabelSnapshot: food.servingLabel,
      kcalPerServing: food.kcal,
      proteinPerServing: food.proteinG,
      carbPerServing: food.carbG,
      fatPerServing: food.fatG,
      fibrePerServing: food.fibreG,
    };
  }

  return {
    ...base,
    foodId: null,
    nameSnapshot: requireString(item.name, 'name', 120),
    servingLabelSnapshot: optionalString(item.servingLabel, 'servingLabel', 60) ?? '1 serving',
    kcalPerServing: requireNumber(item.kcalPerServing ?? item.kcal, 'kcalPerServing', RANGES.kcal),
    proteinPerServing: requireNumber(item.proteinPerServing ?? item.proteinG ?? 0, 'proteinPerServing', RANGES.macroG),
    carbPerServing: requireNumber(item.carbPerServing ?? item.carbG ?? 0, 'carbPerServing', RANGES.macroG),
    fatPerServing: requireNumber(item.fatPerServing ?? item.fatG ?? 0, 'fatPerServing', RANGES.macroG),
    fibrePerServing: requireNumber(item.fibrePerServing ?? item.fibreG ?? 0, 'fibrePerServing', RANGES.macroG),
  };
}

/**
 * Log one item, or several at once.
 *
 * The batch form (`items: [...]`) exists so the search sheet's multi-select
 * saves N foods in one request instead of N.
 */
export async function POST(req: NextRequest) {
  return handleCreate(async () => {
    const user = await requireUser();
    const body = await readJson(req);
    const dayKey = requireDayKey(body.dayKey);
    const mealSlotId = requireString(body.mealSlotId, 'mealSlotId', 40);

    const slot = await prisma.mealSlot.findFirst({
      where: { id: mealSlotId, userId: user.id },
    });
    if (!slot) fail('Meal slot not found', 404);

    const rawItems = Array.isArray(body.items) ? body.items : [body];
    if (rawItems.length === 0) fail('Nothing to log');
    if (rawItems.length > 50) fail('Too many items in one request (max 50)');

    const prepared: PreparedEntry[] = [];
    for (const raw of rawItems) {
      if (raw === null || typeof raw !== 'object') fail('Each item must be an object');
      prepared.push(
        await prepareItem(raw as Record<string, unknown>, user, dayKey, mealSlotId),
      );
    }

    // One transaction so a partial batch can't land, and so the usage counters
    // move in step with the entries that caused them.
    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const item of prepared) {
        rows.push(await tx.foodEntry.create({ data: item }));
        if (item.foodId) await bumpFoodUsage(tx, user.id, item.foodId);
      }
      return rows;
    });

    const entries = created.map(toFoodEntryDto);
    return {
      // Single-item callers get `entry`; batch callers read `entries`.
      entry: entries[0],
      entries,
      totals: await getDayTotals(user, dayKey),
    };
  });
}
