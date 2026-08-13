import type { NextRequest } from 'next/server';

import { FOOD_CATEGORIES, type FoodCategory } from '@/data/types';
import { foodUsageMap, toFoodDto, visibleToUser } from '@/lib/day';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import {
  RANGES,
  handleCreate,
  handleRoute,
  normalizeAliases,
  optionalBoolean,
  optionalNumber,
  optionalString,
  readJson,
  requireNumber,
  requireString,
  toNameLower,
} from '@/lib/validate';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

/**
 * Food search.
 *
 * Visibility is "the shared built-in catalogue OR my own foods" — never another
 * user's custom food. `mode` shapes the result set for the sheet's tabs:
 *   search    — name/alias match, best guesses first (the default when q is set)
 *   recent    — most recently logged BY THIS USER
 *   frequent  — most often logged BY THIS USER
 *   mine      — the user's own foods
 */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const userId = user.id;
    const sp = req.nextUrl.searchParams;
    const q = (sp.get('q') ?? '').trim().toLowerCase();
    const category = sp.get('category');
    const mode = sp.get('mode') ?? (q ? 'search' : 'default');
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get('limit')) || DEFAULT_LIMIT));

    const categoryFilter =
      category && FOOD_CATEGORIES.includes(category as FoodCategory)
        ? { category }
        : {};

    const base = { isArchived: false, ...visibleToUser(userId), ...categoryFilter };

    /** Attach this user's usage counters to a page of foods. */
    const withUsage = async (rows: Awaited<ReturnType<typeof prisma.food.findMany>>) => {
      const usage = await foodUsageMap(userId, rows.map((r) => r.id));
      return { foods: rows.map((r) => toFoodDto(r, usage.get(r.id))) };
    };

    // Recent/Frequent are driven by the per-user usage table, so they start from
    // FoodUsage and join back to Food.
    if (mode === 'recent' || mode === 'frequent') {
      const usageRows = await prisma.foodUsage.findMany({
        where: { userId, food: base },
        orderBy:
          mode === 'recent' ? { lastUsedAt: 'desc' } : [{ usageCount: 'desc' }],
        take: limit,
        include: { food: true },
      });
      return {
        foods: usageRows.map((u) =>
          toFoodDto(u.food, { usageCount: u.usageCount, lastUsedAt: u.lastUsedAt }),
        ),
      };
    }

    if (mode === 'mine') {
      return withUsage(
        await prisma.food.findMany({
          where: { isArchived: false, userId, isCustom: true, ...categoryFilter },
          orderBy: { name: 'asc' },
          take: limit,
        }),
      );
    }

    if (mode === 'all') {
      return withUsage(
        await prisma.food.findMany({ where: base, orderBy: { name: 'asc' }, take: limit }),
      );
    }

    if (!q) {
      // Zero-keystroke view: what you reach for most, then what you had last.
      const usageRows = await prisma.foodUsage.findMany({
        where: { userId, food: base },
        orderBy: [{ lastUsedAt: 'desc' }],
        take: limit,
        include: { food: true },
      });
      if (usageRows.length > 0) {
        return {
          foods: usageRows.map((u) =>
            toFoodDto(u.food, { usageCount: u.usageCount, lastUsedAt: u.lastUsedAt }),
          ),
        };
      }
      // Brand-new account with nothing logged: show some of the catalogue rather
      // than an empty sheet.
      return withUsage(
        await prisma.food.findMany({ where: base, orderBy: { name: 'asc' }, take: limit }),
      );
    }

    // SQLite has no case-insensitive LIKE, hence the stored nameLower/aliases.
    const matches = await prisma.food.findMany({
      where: {
        ...base,
        OR: [{ nameLower: { contains: q } }, { aliases: { contains: q } }],
      },
      // Over-fetch so the relevance sort below has something to work with.
      take: limit * 4,
    });

    const usage = await foodUsageMap(userId, matches.map((m) => m.id));

    // Rank in memory: a name that starts with the query beats one that merely
    // contains it, and a food you actually eat beats one you never log.
    const scored = matches
      .map((f) => {
        const name = f.nameLower;
        let score = 0;
        if (name === q) score += 100;
        else if (name.startsWith(q)) score += 60;
        else if (new RegExp(`\\b${escapeRegExp(q)}`).test(name)) score += 40;
        else score += 10;
        if (f.aliases.split(',').some((a) => a === q)) score += 50;
        if (f.isCustom) score += 15; // the user's own foods matter more
        score += Math.min(20, usage.get(f.id)?.usageCount ?? 0);
        return { food: f, score };
      })
      .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name))
      .slice(0, limit);

    return { foods: scored.map((s) => toFoodDto(s.food, usage.get(s.food.id))) };
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function POST(req: NextRequest) {
  return handleCreate(async () => {
    const user = await requireUser();
    const body = await readJson(req);

    const name = requireString(body.name, 'name', 120);
    const servingLabel = requireString(body.servingLabel, 'servingLabel', 60);
    const kcal = requireNumber(body.kcal, 'kcal', RANGES.kcal);
    const proteinG = requireNumber(body.proteinG ?? 0, 'proteinG', RANGES.macroG);
    const carbG = requireNumber(body.carbG ?? 0, 'carbG', RANGES.macroG);
    const fatG = requireNumber(body.fatG ?? 0, 'fatG', RANGES.macroG);
    const fibreG = requireNumber(body.fibreG ?? 0, 'fibreG', RANGES.macroG);
    const servingGrams = optionalNumber(body.servingGrams, 'servingGrams', {
      min: 0,
      max: 5000,
    });
    const category = optionalString(body.category, 'category', 40) ?? 'other';
    const isVeg = optionalBoolean(body.isVeg, 'isVeg') ?? true;

    const food = await prisma.food.create({
      data: {
        userId: user.id, // a custom food belongs to its creator
        name,
        nameLower: toNameLower(name),
        aliases: normalizeAliases(body.aliases),
        category: FOOD_CATEGORIES.includes(category as FoodCategory)
          ? category
          : 'other',
        cuisine: 'indian',
        servingLabel,
        servingGrams: servingGrams ?? null,
        kcal,
        proteinG,
        carbG,
        fatG,
        fibreG,
        isVeg,
        isCustom: true,
      },
    });

    return { food: toFoodDto(food) };
  });
}
