'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { localDayKey } from '@/lib/calc/dates';
import { fetchDay } from '@/lib/api';
import type { DayDto } from '@/types/dto';

/**
 * Holds the selected day and its payload, shared by every screen.
 *
 * The client owns "what day is it": `localDayKey()` runs in the browser, so the
 * day boundary follows the user's own clock rather than the server's. This is
 * what keeps a 00:15 snack on the right day.
 */

interface DayContextValue {
  dayKey: string;
  today: string;
  setDayKey: (key: string) => void;
  day: DayDto | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch the current day from the server. */
  refresh: () => Promise<void>;
  /** Replace the cached payload — used for optimistic updates. */
  mutate: (next: DayDto | ((prev: DayDto) => DayDto)) => void;
  /** Open the food search sheet; provided by the shell. */
  openFoodSheet: (mealSlotId?: string) => void;
  registerFoodSheetOpener: (fn: (mealSlotId?: string) => void) => void;
}

const DayContext = createContext<DayContextValue | null>(null);

export function useDay(): DayContextValue {
  const ctx = useContext(DayContext);
  if (!ctx) throw new Error('useDay must be used inside <DayProvider>');
  return ctx;
}

export function DayProvider({ children }: { children: ReactNode }) {
  // Start from the server's date to keep the first render deterministic, then
  // correct to the browser's local day on mount (they differ across midnight
  // and across timezones).
  const [today, setToday] = useState(() => localDayKey());
  const [dayKey, setDayKey] = useState(today);
  const [day, setDay] = useState<DayDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openFoodSheetFn, setOpenFoodSheetFn] = useState<
    ((mealSlotId?: string) => void) | null
  >(null);

  const load = useCallback(async (key: string) => {
    try {
      const next = await fetchDay(key);
      setDay(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this day');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch whenever the selected day changes. `load` awaits before touching
  // state, so nothing is set synchronously inside the effect body.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchDay(dayKey).catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load this day');
        }
        return null;
      });
      if (cancelled) return;
      if (next) {
        setDay(next);
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [dayKey]);

  // If the app is left open past midnight, roll the day over on return so the
  // user isn't quietly logging into yesterday.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const nowKey = localDayKey();
      if (nowKey !== today) {
        setToday(nowKey);
        setDayKey(nowKey);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [today]);

  const value = useMemo<DayContextValue>(
    () => ({
      dayKey,
      today,
      setDayKey,
      day,
      loading,
      error,
      refresh: () => load(dayKey),
      mutate: (next) =>
        setDay((prev) =>
          typeof next === 'function' ? (prev ? next(prev) : prev) : next,
        ),
      openFoodSheet: (mealSlotId) => openFoodSheetFn?.(mealSlotId),
      registerFoodSheetOpener: (fn) => setOpenFoodSheetFn(() => fn),
    }),
    [dayKey, today, day, loading, error, load, openFoodSheetFn],
  );

  return <DayContext.Provider value={value}>{children}</DayContext.Provider>;
}
