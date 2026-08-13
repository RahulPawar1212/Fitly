import type { NextRequest } from 'next/server';

import { FOOD_CATEGORIES, type FoodCategory } from '@/data/types';
import { toFoodDto, visibleToUser } from '@/lib/day';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import {
  RANGES,
  fail,
  handleRoute,
  normalizeAliases,
  optionalBoolean,
  optionalNumber,
  optionalString,
  readJson,
  toNameLower,
} from '@/lib/validate';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handleRoute(async () => {
    const user = await requireUser();
    const food = await prisma.food.findFirst({
      where: { id, ...visibleToUser(user.id) },
    });
    if (!food) fail('Food not found', 404);
    return { food: toFoodDto(food) };
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handleRoute(async () => {
    const user = await requireUser();

    // Only ever this user's OWN food: a built-in (userId null) or someone else's
    // must both be untouchable.
    const existing = await prisma.food.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      // Distinguish "built-in, so read-only" from "doesn't exist for you", since
      // the first is a useful message and reveals nothing private.
      const shared = await prisma.food.findFirst({ where: { id, userId: null } });
      if (shared) {
        fail(
          'Built-in foods cannot be edited. Create your own version of it instead.',
          403,
        );
      }
      fail('Food not found', 404);
    }

    const body = await readJson(req);
    const name = optionalString(body.name, 'name', 120);
    const servingLabel = optionalString(body.servingLabel, 'servingLabel', 60);
    const kcal = optionalNumber(body.kcal, 'kcal', RANGES.kcal);
    const proteinG = optionalNumber(body.proteinG, 'proteinG', RANGES.macroG);
    const carbG = optionalNumber(body.carbG, 'carbG', RANGES.macroG);
    const fatG = optionalNumber(body.fatG, 'fatG', RANGES.macroG);
    const fibreG = optionalNumber(body.fibreG, 'fibreG', RANGES.macroG);
    const servingGrams = optionalNumber(body.servingGrams, 'servingGrams', {
      min: 0,
      max: 5000,
    });
    const category = optionalString(body.category, 'category', 40);
    const isVeg = optionalBoolean(body.isVeg, 'isVeg');

    const food = await prisma.food.update({
      where: { id },
      data: {
        // Renaming must recompute nameLower or search stops finding the row.
        ...(name !== undefined && { name, nameLower: toNameLower(name) }),
        ...(body.aliases !== undefined && { aliases: normalizeAliases(body.aliases) }),
        ...(servingLabel !== undefined && { servingLabel }),
        ...(kcal !== undefined && { kcal }),
        ...(proteinG !== undefined && { proteinG }),
        ...(carbG !== undefined && { carbG }),
        ...(fatG !== undefined && { fatG }),
        ...(fibreG !== undefined && { fibreG }),
        ...(servingGrams !== undefined && { servingGrams }),
        ...(category !== undefined &&
          FOOD_CATEGORIES.includes(category as FoodCategory) && { category }),
        ...(isVeg !== undefined && { isVeg }),
      },
    });

    return { food: toFoodDto(food) };
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handleRoute(async () => {
    const user = await requireUser();
    const existing = await prisma.food.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      const shared = await prisma.food.findFirst({ where: { id, userId: null } });
      if (shared) fail('Built-in foods cannot be deleted.', 403);
      fail('Food not found', 404);
    }

    // Entries snapshot their nutrition, so deleting the food would not corrupt
    // history — but keeping the row lets the entry still link back to it, so
    // archive when referenced and hard-delete only when nothing points here.
    const referenced = await prisma.foodEntry.count({ where: { foodId: id } });
    if (referenced > 0) {
      const food = await prisma.food.update({
        where: { id },
        data: { isArchived: true },
      });
      return { ok: true as const, archived: true, food: toFoodDto(food) };
    }

    await prisma.food.delete({ where: { id } });
    return { ok: true as const, archived: false };
  });
}
