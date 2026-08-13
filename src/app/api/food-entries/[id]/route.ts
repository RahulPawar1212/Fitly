import type { NextRequest } from 'next/server';

import { getDayTotals, toFoodEntryDto } from '@/lib/day';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import {
  RANGES,
  fail,
  handleRoute,
  optionalNumber,
  optionalString,
  readJson,
  requireDayKey,
} from '@/lib/validate';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handleRoute(async () => {
    const user = await requireUser();

    // Scoped lookup — a bare findUnique here would be an IDOR.
    const existing = await prisma.foodEntry.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) fail('Entry not found', 404);

    const body = await readJson(req);
    const servings = optionalNumber(body.servings, 'servings', RANGES.servings);
    const mealSlotId = optionalString(body.mealSlotId, 'mealSlotId', 40);
    const dayKey = body.dayKey === undefined ? undefined : requireDayKey(body.dayKey);
    const note = body.note === undefined ? undefined : optionalString(body.note, 'note', 200) ?? null;

    if (mealSlotId !== undefined) {
      // The destination slot must belong to this user too, or an entry could be
      // parked in someone else's meal.
      const slot = await prisma.mealSlot.findFirst({
        where: { id: mealSlotId, userId: user.id },
      });
      if (!slot) fail('Meal slot not found', 404);
    }

    // Snapshot nutrition is deliberately not patchable — an entry records what
    // was eaten. To fix the numbers, delete it and log it again.
    const entry = await prisma.foodEntry.update({
      where: { id },
      data: {
        ...(servings !== undefined && { servings }),
        ...(mealSlotId !== undefined && { mealSlotId }),
        ...(dayKey !== undefined && { dayKey }),
        ...(note !== undefined && { note }),
      },
    });

    // Moving an entry between days changes two days' totals; report both.
    const movedFrom =
      dayKey !== undefined && dayKey !== existing.dayKey ? existing.dayKey : null;

    return {
      entry: toFoodEntryDto(entry),
      totals: await getDayTotals(user, entry.dayKey),
      ...(movedFrom && { previousDayTotals: await getDayTotals(user, movedFrom) }),
    };
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handleRoute(async () => {
    const user = await requireUser();
    const existing = await prisma.foodEntry.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) fail('Entry not found', 404);

    await prisma.foodEntry.delete({ where: { id } });
    return { ok: true as const, totals: await getDayTotals(user, existing.dayKey) };
  });
}
