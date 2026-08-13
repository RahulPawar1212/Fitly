'use client';

import { useEffect, useState } from 'react';

import { TopBar } from '@/components/nav/TopBar';
import { Card, Spinner } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import {
  createMealSlot,
  deleteMealSlot,
  fetchMealSlots,
  updateMealSlot,
} from '@/lib/api';
import type { MealSlotDto } from '@/types/dto';

/** Manage meal slots: rename, reorder, switch off, add. */
export default function MealSlotsPage() {
  const toast = useToast();
  const [slots, setSlots] = useState<MealSlotDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  const reload = () =>
    fetchMealSlots(true)
      .then(setSlots)
      .catch(() => toast.error('Could not load meal slots'));

  useEffect(() => {
    void reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function rename(slot: MealSlotDto, name: string) {
    if (!name.trim() || name === slot.name) return;
    try {
      await updateMealSlot(slot.id, { name: name.trim() });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not rename');
    }
  }

  async function toggle(slot: MealSlotDto) {
    try {
      await updateMealSlot(slot.id, { isActive: !slot.isActive });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update');
    }
  }

  /** Swap sortOrder with the neighbour in `direction`. */
  async function move(index: number, direction: -1 | 1) {
    const a = slots[index];
    const b = slots[index + direction];
    if (!a || !b) return;
    try {
      await Promise.all([
        updateMealSlot(a.id, { sortOrder: b.sortOrder }),
        updateMealSlot(b.id, { sortOrder: a.sortOrder }),
      ]);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reorder');
    }
  }

  async function remove(slot: MealSlotDto) {
    try {
      await deleteMealSlot(slot.id);
      await reload();
      toast.show(`${slot.name} deleted`);
    } catch (err) {
      // A 409 here means the slot has history; the message explains the
      // deactivate alternative.
      toast.error(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  async function add() {
    if (!newName.trim()) return;
    try {
      await createMealSlot(newName.trim());
      setNewName('');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add');
    }
  }

  return (
    <>
      <TopBar title="Meal slots" back="/profile" showHistory={false} showProfile={false} />

      {loading && <Spinner />}

      <div className="flex flex-col gap-2 pb-4">
        {slots.map((slot, i) => (
          <Card key={slot.id} className={slot.isActive ? '' : 'opacity-60'}>
            <div className="flex items-center gap-2">
              <input
                defaultValue={slot.name}
                onBlur={(e) => void rename(slot, e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-lg border border-transparent px-2 text-sm font-medium hover:border-slate-300 focus:border-slate-300 dark:hover:border-slate-700 dark:focus:border-slate-700 dark:bg-transparent"
              />
              <button
                type="button"
                onClick={() => void move(i, -1)}
                disabled={i === 0}
                aria-label="Move up"
                className="flex h-10 w-9 items-center justify-center rounded-lg text-slate-400 disabled:opacity-25"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => void move(i, 1)}
                disabled={i === slots.length - 1}
                aria-label="Move down"
                className="flex h-10 w-9 items-center justify-center rounded-lg text-slate-400 disabled:opacity-25"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void toggle(slot)}
                className="min-h-10 flex-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {slot.isActive ? 'Turn off' : 'Turn on'}
              </button>
              <button
                type="button"
                onClick={() => void remove(slot)}
                className="min-h-10 flex-1 rounded-lg bg-rose-50 text-xs font-semibold text-rose-600 dark:bg-rose-900/30 dark:text-rose-300"
              >
                Delete
              </button>
            </div>
          </Card>
        ))}

        <Card>
          <label className="mb-2 block text-sm font-semibold">Add a slot</label>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Pre-workout"
              className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-base dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="button"
              onClick={() => void add()}
              disabled={!newName.trim()}
              className="min-h-12 shrink-0 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </Card>

        <p className="px-1 text-xs text-slate-500">
          Turning a slot off hides it when logging but keeps its history. Slots with
          logged food can&apos;t be deleted.
        </p>
      </div>
    </>
  );
}
