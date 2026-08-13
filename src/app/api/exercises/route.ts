import type { NextRequest } from 'next/server';

import { EXERCISE_CATEGORIES, type ExerciseCategory } from '@/data/types';
import { metIntensity } from '@/lib/calc/burn';
import { exerciseUsageMap, toExerciseDto, visibleToUser } from '@/lib/day';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import {
  RANGES,
  handleCreate,
  handleRoute,
  optionalString,
  readJson,
  requireNumber,
  requireString,
  toNameLower,
} from '@/lib/validate';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const userId = user.id;
    const sp = req.nextUrl.searchParams;
    const q = (sp.get('q') ?? '').trim().toLowerCase();
    const category = sp.get('category');
    const mode = sp.get('mode') ?? (q ? 'search' : 'default');
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get('limit')) || DEFAULT_LIMIT));

    // The picker shows "~5.2 kcal/min for you", so every response needs weight.
    const weight = user.weightKg;

    const categoryFilter =
      category && EXERCISE_CATEGORIES.includes(category as ExerciseCategory)
        ? { category }
        : {};
    const base = { isArchived: false, ...visibleToUser(userId), ...categoryFilter };

    const withUsage = async (
      rows: Awaited<ReturnType<typeof prisma.exercise.findMany>>,
    ) => {
      const usage = await exerciseUsageMap(userId, rows.map((r) => r.id));
      return { exercises: rows.map((r) => toExerciseDto(r, weight, usage.get(r.id))) };
    };

    if (mode === 'recent' || mode === 'frequent') {
      const usageRows = await prisma.exerciseUsage.findMany({
        where: { userId, exercise: base },
        orderBy: mode === 'recent' ? { lastUsedAt: 'desc' } : [{ usageCount: 'desc' }],
        take: limit,
        include: { exercise: true },
      });
      return {
        exercises: usageRows.map((u) =>
          toExerciseDto(u.exercise, weight, {
            usageCount: u.usageCount,
            lastUsedAt: u.lastUsedAt,
          }),
        ),
      };
    }

    if (mode === 'mine') {
      return withUsage(
        await prisma.exercise.findMany({
          where: { isArchived: false, userId, isCustom: true, ...categoryFilter },
          orderBy: { name: 'asc' },
          take: limit,
        }),
      );
    }

    if (!q) {
      // Category browsing is the norm here, so default to the whole visible list.
      return withUsage(
        await prisma.exercise.findMany({
          where: base,
          orderBy: { name: 'asc' },
          take: limit,
        }),
      );
    }

    const rows = await prisma.exercise.findMany({
      where: { ...base, nameLower: { contains: q } },
      take: limit * 3,
    });
    const usage = await exerciseUsageMap(userId, rows.map((r) => r.id));

    const scored = rows
      .map((e) => {
        let score = e.nameLower.startsWith(q) ? 60 : 20;
        if (e.isCustom) score += 15;
        score += Math.min(20, usage.get(e.id)?.usageCount ?? 0);
        return { e, score };
      })
      .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name))
      .slice(0, limit);

    return {
      exercises: scored.map((s) => toExerciseDto(s.e, weight, usage.get(s.e.id))),
    };
  });
}

export async function POST(req: NextRequest) {
  return handleCreate(async () => {
    const user = await requireUser();
    const body = await readJson(req);
    const name = requireString(body.name, 'name', 120);
    const met = requireNumber(body.met, 'met', RANGES.met);
    const category = optionalString(body.category, 'category', 40) ?? 'other';
    const intensity = optionalString(body.intensity, 'intensity', 20);

    const exercise = await prisma.exercise.create({
      data: {
        userId: user.id,
        name,
        nameLower: toNameLower(name),
        category: EXERCISE_CATEGORIES.includes(category as ExerciseCategory)
          ? category
          : 'other',
        met,
        // Derive the band when the caller doesn't state one.
        intensity: intensity ?? metIntensity(met),
        isCustom: true,
      },
    });

    return { exercise: toExerciseDto(exercise, user.weightKg) };
  });
}
