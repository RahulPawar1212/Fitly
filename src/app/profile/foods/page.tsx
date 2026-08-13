'use client';

import { useEffect, useMemo, useState } from 'react';

import { CustomFoodForm } from '@/components/food/CustomFoodForm';
import { TopBar } from '@/components/nav/TopBar';
import { Card, EmptyState, Spinner } from '@/components/ui/EmptyState';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { FOOD_CATEGORY_LABELS, type FoodCategory } from '@/data/types';
import { deleteFood, fetchFoods } from '@/lib/api';
import type { FoodDto } from '@/types/dto';

type Editing = { kind: 'new' } | { kind: 'edit'; food: FoodDto } | null;

/**
 * Profile → My foods.
 *
 * Full management of the foods you've created: add, edit, delete, and search
 * once the list grows. The add-food sheet can also create one mid-log, but that
 * path is optimised for speed — this is where you curate them properly.
 */
export default function MyFoodsPage() {
  const toast = useToast();
  const [foods, setFoods] = useState<FoodDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing>(null);
  const [query, setQuery] = useState('');

  const reload = () =>
    fetchFoods({ mode: 'mine', limit: 200 })
      .then(setFoods)
      .catch(() => toast.error('Could not load your foods'));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchFoods({ mode: 'mine', limit: 200 });
        if (!cancelled) setFoods(next);
      } catch {
        if (!cancelled) toast.error('Could not load your foods');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return foods;
    return foods.filter((f) => f.name.toLowerCase().includes(q));
  }, [foods, query]);

  async function remove(food: FoodDto) {
    try {
      const res = await deleteFood(food.id);
      await reload();
      toast.show(
        res.archived
          ? `${food.name} hidden (kept for your history)`
          : `${food.name} deleted`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  return (
    <>
      <TopBar title="My foods" back="/profile" showHistory={false} showProfile={false} />

      <button
        type="button"
        onClick={() => setEditing({ kind: 'new' })}
        className="mb-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-base font-semibold text-white transition active:scale-[0.99]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        Add a food
      </button>

      {/* Only worth the space once the list is long enough to scroll. */}
      {foods.length > 8 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          placeholder="Search your foods"
          className="mb-3 h-12 w-full rounded-xl border border-slate-300 px-3 text-base dark:border-slate-700 dark:bg-slate-800"
        />
      )}

      {loading && <Spinner />}

      {!loading && foods.length === 0 && (
        <EmptyState
          title="No custom foods yet"
          hint="Add anything the built-in list is missing — your mum's rajma, a protein bar, a local snack."
        />
      )}

      {!loading && foods.length > 0 && visible.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">
          No matches for “{query}”.
        </p>
      )}

      <div className="flex flex-col gap-2 pb-4">
        {visible.map((food) => (
          <Card key={food.id}>
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => setEditing({ kind: 'edit', food })}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    aria-label={food.isVeg ? 'Vegetarian' : 'Non-vegetarian'}
                    className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm border ${
                      food.isVeg
                        ? 'border-green-600 bg-green-500'
                        : 'border-red-700 bg-red-600'
                    }`}
                  />
                  <span className="text-sm font-medium">{food.name}</span>
                </span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  {Math.round(food.kcal)} kcal per {food.servingLabel}
                </span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  P{food.proteinG} C{food.carbG} F{food.fatG} Fib{food.fibreG}
                  {' · '}
                  {FOOD_CATEGORY_LABELS[food.category as FoodCategory] ?? food.category}
                  {food.usageCount > 0 && ` · logged ${food.usageCount}×`}
                </span>
              </button>

              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setEditing({ kind: 'edit', food })}
                  aria-label={`Edit ${food.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M4 20h4L20 8l-4-4L4 16v4z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => void remove(food)}
                  aria-label={`Delete ${food.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.kind === 'edit' ? 'Edit food' : 'New food'}
        height="auto"
      >
        {editing && (
          <CustomFoodForm
            // Remount on target change so the form re-seeds its fields.
            key={editing.kind === 'edit' ? editing.food.id : 'new'}
            food={editing.kind === 'edit' ? editing.food : undefined}
            onCancel={() => setEditing(null)}
            onSaved={async (food) => {
              setEditing(null);
              await reload();
              toast.show(
                editing.kind === 'edit' ? `${food.name} updated` : `${food.name} added`,
              );
            }}
          />
        )}
      </Sheet>
    </>
  );
}
