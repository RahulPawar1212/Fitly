import type { NextRequest } from 'next/server';

import { toMealSlotDto } from '@/lib/day';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import {
  handleCreate,
  handleRoute,
  optionalNumber,
  readJson,
  requireString,
  slugify,
} from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const includeInactive = req.nextUrl.searchParams.get('includeInactive') === '1';
    const slots = await prisma.mealSlot.findMany({
      where: { userId: user.id, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { sortOrder: 'asc' },
    });
    return { mealSlots: slots.map(toMealSlotDto) };
  });
}

export async function POST(req: NextRequest) {
  return handleCreate(async () => {
    const user = await requireUser();
    const body = await readJson(req);
    const name = requireString(body.name, 'name', 40);
    const requestedOrder = optionalNumber(body.sortOrder, 'sortOrder', {
      min: 0,
      max: 100000,
    });

    // Keys are unique per user, so a second "Snack" only collides with this
    // user's own slots.
    const base = slugify(name);
    let key = base;
    for (
      let n = 2;
      await prisma.mealSlot.findFirst({ where: { userId: user.id, key } });
      n++
    ) {
      key = `${base}-${n}`;
    }

    // Append by default, leaving a gap of 10 so a later slot can be slotted in.
    let sortOrder = requestedOrder;
    if (sortOrder === undefined) {
      const max = await prisma.mealSlot.aggregate({
        where: { userId: user.id },
        _max: { sortOrder: true },
      });
      sortOrder = (max._max.sortOrder ?? 0) + 10;
    }

    const slot = await prisma.mealSlot.create({
      data: { userId: user.id, key, name, sortOrder },
    });
    return { mealSlot: toMealSlotDto(slot) };
  });
}
