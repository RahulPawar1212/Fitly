import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { fail, handleRoute } from '@/lib/validate';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handleRoute(async () => {
    const user = await requireUser();

    // findFirst with BOTH id and userId, never findUnique on the bare id —
    // otherwise any signed-in user could delete anyone's row by guessing an id.
    const existing = await prisma.weightLog.findFirst({
      where: { id, userId: user.id },
    });
    // "Not found" rather than "forbidden": don't confirm that an id exists.
    if (!existing) fail('Weight log not found', 404);

    await prisma.weightLog.delete({ where: { id } });
    return { ok: true as const };
  });
}
