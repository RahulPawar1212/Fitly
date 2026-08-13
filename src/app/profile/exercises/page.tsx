'use client';

import { useEffect, useMemo, useState } from 'react';

import { CustomExerciseForm } from '@/components/exercise/CustomExerciseForm';
import { TopBar } from '@/components/nav/TopBar';
import { Card, EmptyState, Spinner } from '@/components/ui/EmptyState';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { EXERCISE_CATEGORY_LABELS, type ExerciseCategory } from '@/data/types';
import { deleteExercise, fetchExercises, fetchProfile } from '@/lib/api';
import type { ExerciseDto } from '@/types/dto';

type Editing = { kind: 'new' } | { kind: 'edit'; exercise: ExerciseDto } | null;

/**
 * Profile → My exercises.
 *
 * Add, edit and delete the exercises you've defined yourself. Body weight is
 * fetched so the MET field can show what it means in kcal/min for you.
 */
export default function MyExercisesPage() {
  const toast = useToast();
  const [items, setItems] = useState<ExerciseDto[]>([]);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing>(null);
  const [query, setQuery] = useState('');

  const reload = () =>
    fetchExercises({ mode: 'mine', limit: 200 })
      .then(setItems)
      .catch(() => toast.error('Could not load your exercises'));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [list, profile] = await Promise.all([
          fetchExercises({ mode: 'mine', limit: 200 }),
          fetchProfile().catch(() => null),
        ]);
        if (cancelled) return;
        setItems(list);
        setWeightKg(profile?.weightKg ?? null);
      } catch {
        if (!cancelled) toast.error('Could not load your exercises');
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
    if (!q) return items;
    return items.filter((e) => e.name.toLowerCase().includes(q));
  }, [items, query]);

  async function remove(ex: ExerciseDto) {
    try {
      const res = await deleteExercise(ex.id);
      await reload();
      toast.show(res.archived ? `${ex.name} hidden` : `${ex.name} deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  return (
    <>
      <TopBar
        title="My exercises"
        back="/profile"
        showHistory={false}
        showProfile={false}
      />

      <button
        type="button"
        onClick={() => setEditing({ kind: 'new' })}
        className="mb-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-base font-semibold text-white transition active:scale-[0.99]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        Add an exercise
      </button>

      {weightKg == null && (
        <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          Set your weight in Profile to see what each intensity burns for you.
        </p>
      )}

      {items.length > 8 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          placeholder="Search your exercises"
          className="mb-3 h-12 w-full rounded-xl border border-slate-300 px-3 text-base dark:border-slate-700 dark:bg-slate-800"
        />
      )}

      {loading && <Spinner />}

      {!loading && items.length === 0 && (
        <EmptyState
          title="No custom exercises yet"
          hint="Add anything the built-in list is missing — your gym circuit, a local sport, a class you attend."
        />
      )}

      {!loading && items.length > 0 && visible.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">
          No matches for “{query}”.
        </p>
      )}

      <div className="flex flex-col gap-2 pb-4">
        {visible.map((ex) => (
          <Card key={ex.id}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing({ kind: 'edit', exercise: ex })}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block text-sm font-medium">{ex.name}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  MET {ex.met}
                  {ex.kcalPerMinuteAtCurrentWeight != null &&
                    ` · ~${ex.kcalPerMinuteAtCurrentWeight.toFixed(1)} kcal/min`}
                </span>
                <span className="block text-xs text-slate-400">
                  {EXERCISE_CATEGORY_LABELS[ex.category as ExerciseCategory] ??
                    ex.category}
                  {ex.usageCount > 0 && ` · logged ${ex.usageCount}×`}
                </span>
              </button>

              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setEditing({ kind: 'edit', exercise: ex })}
                  aria-label={`Edit ${ex.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M4 20h4L20 8l-4-4L4 16v4z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => void remove(ex)}
                  aria-label={`Delete ${ex.name}`}
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
        title={editing?.kind === 'edit' ? 'Edit exercise' : 'New exercise'}
        height="auto"
      >
        {editing && (
          <CustomExerciseForm
            key={editing.kind === 'edit' ? editing.exercise.id : 'new'}
            exercise={editing.kind === 'edit' ? editing.exercise : undefined}
            bodyWeightKg={weightKg}
            onCancel={() => setEditing(null)}
            onSaved={async (ex) => {
              setEditing(null);
              await reload();
              toast.show(
                editing.kind === 'edit' ? `${ex.name} updated` : `${ex.name} added`,
              );
            }}
          />
        )}
      </Sheet>
    </>
  );
}
