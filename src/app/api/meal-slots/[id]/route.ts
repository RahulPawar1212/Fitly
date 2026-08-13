import type { NextRequest } from 'next/server';

import { toMealSlotDto } from '@/lib/day';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import {
  fail,
  handleRoute,
  optionalBoolean,
  optionalNumber,
  optionalString,
  readJson,
} from '@/lib/validate';

export const dynamic = 'force-dynamic';

// Next 16: `params` is a Promise.
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handleRoute(async () => {
    const user = await requireUser();
    const slot = await prisma.mealSlot.findFirst({ where: { id, userId: user.id } });
    if (!slot) fail('Meal slot not found', 404);
    return { mealSlot: toMealSlotDto(slot) };
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handleRoute(async () => {
    const user = await requireUser();
    const body = await readJson(req);
    const name = optionalString(body.name, 'name', 40);
    const sortOrder = optionalNumber(body.sortOrder, 'sortOrder', {
      min: 0,
      max: 100000,
    });
    const isActive = optionalBoolean(body.isActive, 'isActive');

    const existing = await prisma.mealSlot.findFirst({ where: { id, userId: user.id } });
    if (!existing) fail('Meal slot not found', 404);

    const slot = await prisma.mealSlot.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    return { mealSlot: toMealSlotDto(slot) };
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handleRoute(async () => {
    const user = await requireUser();
    const existing = await prisma.mealSlot.findFirst({ where: { id, userId: user.id } });
    if (!existing) fail('Meal slot not found', 404);

    // FoodEntry.mealSlotId is onDelete: Restrict, so this would throw a raw
    // P2003. Check first and answer with something the UI can act on.
    const inUse = await prisma.foodEntry.count({ where: { mealSlotId: id } });
    if (inUse > 0) {
      fail(
        `This slot has ${inUse} logged ${inUse === 1 ? 'entry' : 'entries'}. ` +
          'Turn it off instead of deleting, so your history stays intact.',
        409,
      );
    }

    await prisma.mealSlot.delete({ where: { id } });
    return { ok: true as const };
  });
}
