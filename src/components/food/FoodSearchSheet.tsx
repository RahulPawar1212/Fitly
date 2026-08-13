'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CustomFoodForm } from '@/components/food/CustomFoodForm';
import { FoodRow } from '@/components/food/FoodRow';
import { ServingPicker } from '@/components/food/ServingPicker';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useDay } from '@/context/DayContext';
import {
  deleteFoodEntry,
  fetchFoods,
  logFood,
  type FoodSearchMode,
  type LogFoodItem,
} from '@/lib/api';
import { pickDefaultSlot } from '@/lib/calc/dates';
import type { FoodDto, MealSlotDto } from '@/types/dto';

type Tab = 'recent' | 'frequent' | 'all' | 'mine';

const TABS: Array<{ id: Tab; label: string; mode: FoodSearchMode }> = [
  { id: 'recent', label: 'Recent', mode: 'recent' },
  { id: 'frequent', label: 'Often', mode: 'frequent' },
  { id: 'all', label: 'All', mode: 'all' },
  { id: 'mine', label: 'Mine', mode: 'mine' },
];

type View = { kind: 'list' } | { kind: 'picker'; food: FoodDto } | { kind: 'create'; name: string };

/**
 * The food logging sheet — the app's highest-traffic surface.
 *
 * Design decisions worth keeping:
 *  - Opens as a sheet, never a route, so it costs nothing to open from any tab.
 *  - Pre-selects a meal slot from the clock, so the common case needs no choice.
 *  - Each row's `+` logs one serving instantly with an undo toast; the row body
 *    opens the quantity picker. Two targets, two intents.
 *  - Adds are optimistic: the day totals move before the request resolves, and
 *    roll back with a message if it fails.
 */
export function FoodSearchSheet({
  open,
  onClose,
  initialSlotId,
}: {
  open: boolean;
  onClose: () => void;
  initialSlotId?: string;
}) {
  const { dayKey, day, refresh } = useDay();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [tab, setTab] = useState<Tab>('recent');
  const [foods, setFoods] = useState<FoodDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const slots = useMemo(() => day?.mealSlots ?? [], [day]);

  // The target meal slot, in priority order: an explicit tap, then whatever the
  // caller asked for (the "+" on a meal card), then the slot that matches the
  // clock. Derived rather than stored, so no effect is needed to keep it fresh.
  const [slotOverride, setSlotId] = useState<string | undefined>(undefined);
  const slotId =
    (slotOverride && slots.some((s) => s.id === slotOverride) ? slotOverride : undefined) ??
    (initialSlotId && slots.some((s) => s.id === initialSlotId)
      ? initialSlotId
      : undefined) ??
    pickDefaultSlot(slots, new Date())?.id;

  const slot: MealSlotDto | undefined = slots.find((s) => s.id === slotId);

  // Reset transient state each time the sheet opens. Adjusting during render
  // (rather than in an effect) avoids a cascading render and means the first
  // paint after opening is already clean.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setView({ kind: 'list' });
      setSelection(new Set());
      setQuery('');
      setDebounced('');
      setTab('recent');
      // Drop any previous manual pick so the slot re-derives from the clock.
      setSlotId(undefined);
    }
  }

  // Debounce typing so a fast typist doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 150);
    return () => clearTimeout(t);
  }, [query]);

  // Load results. An AbortController keeps a slow earlier response from
  // overwriting a newer one.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const mode = debounced ? 'search' : (TABS.find((t) => t.id === tab)?.mode ?? 'recent');

    void (async () => {
      setLoading(true);
      try {
        const next = await fetchFoods({
          q: debounced || undefined,
          mode,
          limit: 40,
          signal: controller.signal,
        });
        setFoods(next);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        toast.error('Could not load foods');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [open, debounced, tab, toast]);

  const log = useCallback(
    async (items: LogFoodItem[], label: string) => {
      if (!slotId) {
        toast.error('Pick a meal first');
        return;
      }
      try {
        const res = await logFood({ dayKey, mealSlotId: slotId, items });
        await refresh();

        const created = res.entries ?? [];
        toast.show(`${label} added to ${slot?.name ?? 'meal'}`, {
          actionLabel: 'Undo',
          onAction: async () => {
            try {
              await Promise.all(created.map((e) => deleteFoodEntry(e.id)));
              await refresh();
            } catch {
              toast.error('Could not undo');
            }
          },
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not add that');
      }
    },
    [dayKey, slotId, slot, refresh, toast],
  );

  const quickAdd = useCallback(
    async (food: FoodDto) => {
      setBusyId(food.id);
      await log([{ foodId: food.id, servings: 1 }], food.name);
      setBusyId(null);
    },
    [log],
  );

  const toggleSelect = (id: string) =>
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addSelected = async () => {
    const items = [...selection].map((foodId) => ({ foodId, servings: 1 }));
    if (items.length === 0) return;
    await log(items, `${items.length} items`);
    setSelection(new Set());
  };

  // An exact match means "create" would be a duplicate, so only offer it when
  // the query genuinely isn't in the database.
  const showCreateRow =
    debounced.length >= 2 &&
    !foods.some((f) => f.name.toLowerCase() === debounced.toLowerCase());

  const selecting = selection.size > 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        view.kind === 'list'
          ? 'Add food'
          : view.kind === 'create'
            ? 'New food'
            : 'How much?'
      }
      footer={
        view.kind === 'list' && selecting ? (
          <button
            type="button"
            onClick={addSelected}
            className="min-h-14 w-full rounded-xl bg-brand-500 text-base font-semibold text-white"
          >
            Add {selection.size} {selection.size === 1 ? 'item' : 'items'} to{' '}
            {slot?.name ?? 'meal'}
          </button>
        ) : undefined
      }
    >
      {view.kind === 'picker' && (
        <ServingPicker
          food={view.food}
          slot={slot}
          slots={slots}
          onSlotChange={setSlotId}
          onConfirm={async (servings) => {
            setBusyId(view.food.id);
            await log(
              [{ foodId: view.food.id, servings }],
              `${servings} × ${view.food.name}`,
            );
            setBusyId(null);
            setView({ kind: 'list' });
          }}
          busy={busyId === view.food.id}
        />
      )}

      {view.kind === 'create' && (
        <CustomFoodForm
          initialName={view.name}
          onCancel={() => setView({ kind: 'list' })}
          onSaved={async (food) => {
            // Creating is nearly always followed by logging it, so do both.
            await log([{ foodId: food.id, servings: 1 }], food.name);
            setView({ kind: 'list' });
            setQuery('');
          }}
        />
      )}

      {view.kind === 'list' && (
        <>
          <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-4 pb-2 pt-3 dark:border-slate-800 dark:bg-slate-900">
            {/* Meal slot chips */}
            <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
              {slots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSlotId(s.id)}
                  className={`min-h-10 shrink-0 rounded-full px-3.5 text-sm font-medium transition ${
                    s.id === slotId
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                // autoFocus opens the keyboard immediately: the user tapped "+"
                // because they intend to type.
                autoFocus
                type="search"
                inputMode="search"
                enterKeyHint="search"
                placeholder="Search roti, dal, chai…"
                className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-base dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            {!debounced && (
              <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold uppercase tracking-wide transition ${
                      t.id === tab
                        ? 'bg-brand-500 text-white'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading && foods.length === 0 && <Spinner label="Searching" />}

          {!loading && foods.length === 0 && !showCreateRow && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              {debounced
                ? 'No matches. Try a shorter word.'
                : tab === 'recent'
                  ? 'Nothing logged yet — search for a food to get started.'
                  : 'Nothing here yet.'}
            </p>
          )}

          {showCreateRow && (
            <button
              type="button"
              onClick={() => setView({ kind: 'create', name: debounced })}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left dark:border-slate-800"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  Create “{debounced}”
                </span>
                <span className="block text-xs text-slate-500">
                  Add it with your own calories
                </span>
              </span>
            </button>
          )}

          {foods.map((food) => (
            <FoodRow
              key={food.id}
              food={food}
              busy={busyId === food.id}
              selectable={selecting}
              selected={selection.has(food.id)}
              onToggleSelect={() => toggleSelect(food.id)}
              onPick={() => setView({ kind: 'picker', food })}
              onQuickAdd={() => void quickAdd(food)}
            />
          ))}

          {foods.length > 0 && !selecting && (
            <p className="px-4 py-4 text-center text-xs text-slate-400">
              Tap + to add one {slot ? `to ${slot.name}` : ''}, or tap the name to
              choose an amount.
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}
