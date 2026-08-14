/**
 * Typed client-side fetch wrappers.
 *
 * Every read passes `cache: 'no-store'` — App Router will otherwise happily
 * serve a cached day payload, which for a tracker means the numbers stop moving.
 */

import type { DayTotals } from '@/lib/calc/nutrition';
import type {
  DayDto,
  ExerciseDto,
  ExerciseEntryDto,
  FoodDto,
  FoodEntryDto,
  HistoryDayDto,
  MealSlotDto,
  ProfileDto,
  WaterDto,
  WeightLogDto,
  WeightTrendDto,
} from '@/types/dto';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Called whenever the API answers 401.
 *
 * AuthContext registers this on mount, so an expired session redirects to the
 * login page from any screen without every caller having to check.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;

    if (res.status === 401) onUnauthorized?.();

    throw new ApiRequestError(message, res.status);
  }

  return data as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

// --------------------------------------------------------------------- auth
export const signup = (body: { email: string; password: string; name?: string }) =>
  post<{ user: ProfileDto }>('/api/auth/signup', body).then((r) => r.user);

export const login = (body: { email: string; password: string }) =>
  post<{ user: ProfileDto }>('/api/auth/login', body).then((r) => r.user);

// ------------------------------------------------------------------ profile
export const fetchProfile = () =>
  get<{ profile: ProfileDto }>('/api/profile').then((r) => r.profile);

export const updateProfile = (patchBody: Partial<Record<string, unknown>>) =>
  patch<{ profile: ProfileDto }>('/api/profile', patchBody).then((r) => r.profile);

// --------------------------------------------------------------- meal slots
export const fetchMealSlots = (includeInactive = false) =>
  get<{ mealSlots: MealSlotDto[] }>(
    `/api/meal-slots${includeInactive ? '?includeInactive=1' : ''}`,
  ).then((r) => r.mealSlots);

export const createMealSlot = (name: string) =>
  post<{ mealSlot: MealSlotDto }>('/api/meal-slots', { name }).then((r) => r.mealSlot);

export const updateMealSlot = (
  id: string,
  body: { name?: string; sortOrder?: number; isActive?: boolean },
) => patch<{ mealSlot: MealSlotDto }>(`/api/meal-slots/${id}`, body).then((r) => r.mealSlot);

export const deleteMealSlot = (id: string) => del<{ ok: true }>(`/api/meal-slots/${id}`);

// -------------------------------------------------------------------- foods
export type FoodSearchMode = 'search' | 'recent' | 'frequent' | 'mine' | 'all';

export function fetchFoods(opts: {
  q?: string;
  mode?: FoodSearchMode;
  category?: string;
  limit?: number;
  signal?: AbortSignal;
} = {}) {
  const sp = new URLSearchParams();
  if (opts.q) sp.set('q', opts.q);
  if (opts.mode) sp.set('mode', opts.mode);
  if (opts.category) sp.set('category', opts.category);
  if (opts.limit) sp.set('limit', String(opts.limit));
  return request<{ foods: FoodDto[] }>(`/api/foods?${sp}`, { signal: opts.signal }).then(
    (r) => r.foods,
  );
}

export interface CustomFoodInput {
  name: string;
  servingLabel: string;
  kcal: number;
  proteinG?: number;
  carbG?: number;
  fatG?: number;
  fibreG?: number;
  servingGrams?: number;
  category?: string;
  isVeg?: boolean;
}

export const createFood = (body: CustomFoodInput) =>
  post<{ food: FoodDto }>('/api/foods', body).then((r) => r.food);

export const updateFood = (id: string, body: Partial<CustomFoodInput>) =>
  patch<{ food: FoodDto }>(`/api/foods/${id}`, body).then((r) => r.food);

export const deleteFood = (id: string) =>
  del<{ ok: true; archived: boolean }>(`/api/foods/${id}`);

// ------------------------------------------------------------- food entries
export interface LogFoodItem {
  foodId?: string;
  servings: number;
  name?: string;
  servingLabel?: string;
  kcalPerServing?: number;
  proteinPerServing?: number;
  carbPerServing?: number;
  fatPerServing?: number;
  fibrePerServing?: number;
  note?: string;
}

export const logFood = (body: {
  dayKey: string;
  mealSlotId: string;
  items?: LogFoodItem[];
} & Partial<LogFoodItem>) =>
  post<{ entry: FoodEntryDto; entries: FoodEntryDto[]; totals: DayTotals }>(
    '/api/food-entries',
    body,
  );

export const updateFoodEntry = (
  id: string,
  body: { servings?: number; mealSlotId?: string; dayKey?: string; note?: string | null },
) => patch<{ entry: FoodEntryDto; totals: DayTotals }>(`/api/food-entries/${id}`, body);

export const deleteFoodEntry = (id: string) =>
  del<{ ok: true; totals: DayTotals }>(`/api/food-entries/${id}`);

// ---------------------------------------------------------------- exercises
export function fetchExercises(opts: {
  q?: string;
  mode?: FoodSearchMode;
  category?: string;
  limit?: number;
  signal?: AbortSignal;
} = {}) {
  const sp = new URLSearchParams();
  if (opts.q) sp.set('q', opts.q);
  if (opts.mode) sp.set('mode', opts.mode);
  if (opts.category) sp.set('category', opts.category);
  if (opts.limit) sp.set('limit', String(opts.limit));
  return request<{ exercises: ExerciseDto[] }>(`/api/exercises?${sp}`, {
    signal: opts.signal,
  }).then((r) => r.exercises);
}

export interface CustomExerciseInput {
  name: string;
  met: number;
  category?: string;
  intensity?: string;
}

export const createExercise = (body: CustomExerciseInput) =>
  post<{ exercise: ExerciseDto }>('/api/exercises', body).then((r) => r.exercise);

export const updateExercise = (id: string, body: Partial<CustomExerciseInput>) =>
  patch<{ exercise: ExerciseDto }>(`/api/exercises/${id}`, body).then((r) => r.exercise);

export const deleteExercise = (id: string) =>
  del<{ ok: true; archived: boolean }>(`/api/exercises/${id}`);

export const logExercise = (body: {
  dayKey: string;
  exerciseId?: string;
  minutes: number;
  name?: string;
  met?: number;
  bodyWeightKg?: number;
  note?: string;
}) =>
  post<{ entry: ExerciseEntryDto; totals: DayTotals }>('/api/exercise-entries', body);

/**
 * Log a walk as a step count. `minutes` is optional — without it the duration is
 * estimated from an average cadence and flagged as such.
 */
export const logSteps = (body: {
  dayKey: string;
  steps: number;
  minutes?: number;
  note?: string;
}) =>
  post<{ entry: ExerciseEntryDto; totals: DayTotals }>('/api/exercise-entries', body);

export const updateExerciseEntry = (
  id: string,
  body: { minutes?: number; steps?: number; dayKey?: string; note?: string | null },
) =>
  patch<{ entry: ExerciseEntryDto; totals: DayTotals }>(
    `/api/exercise-entries/${id}`,
    body,
  );

export const deleteExerciseEntry = (id: string) =>
  del<{ ok: true; totals: DayTotals }>(`/api/exercise-entries/${id}`);

// -------------------------------------------------------------------- day
export const fetchDay = (dayKey: string) => get<DayDto>(`/api/day?date=${dayKey}`);

export const fetchHistory = (days = 30) =>
  get<{ days: HistoryDayDto[] }>(`/api/history?days=${days}`).then((r) => r.days);

// ------------------------------------------------------------------- water
export const fetchWater = (dayKey: string) =>
  get<{ water: WaterDto }>(`/api/water?date=${dayKey}`).then((r) => r.water);

export const adjustWater = (dayKey: string, deltaMl: number) =>
  post<{ water: WaterDto }>('/api/water', { dayKey, deltaMl }).then((r) => r.water);

export const setWater = (dayKey: string, setMl: number) =>
  post<{ water: WaterDto }>('/api/water', { dayKey, setMl }).then((r) => r.water);

// ------------------------------------------------------------------ weight
export const fetchWeightTrend = (days = 90) =>
  get<WeightTrendDto>(`/api/weight?days=${days}`);

export const logWeight = (dayKey: string, weightKg: number, note?: string) =>
  post<{ log: WeightLogDto }>('/api/weight', { dayKey, weightKg, note }).then(
    (r) => r.log,
  );

export const deleteWeightLog = (id: string) => del<{ ok: true }>(`/api/weight/${id}`);
