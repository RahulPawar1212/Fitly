'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { TopBar } from '@/components/nav/TopBar';
import { Card, Spinner } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { fetchExercises, fetchFoods, fetchProfile, updateProfile } from '@/lib/api';
import {
  ACTIVITY_LABELS,
  type ActivityLevel,
  type GoalMode,
} from '@/lib/calc/energy';
import type { ProfileDto } from '@/types/dto';

const ACTIVITY_ORDER: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'veryActive',
];

const GOALS: Array<{ id: GoalMode; label: string; hint: string }> = [
  { id: 'lose', label: 'Lose', hint: '−500 kcal' },
  { id: 'maintain', label: 'Maintain', hint: 'TDEE' },
  { id: 'gain', label: 'Gain', hint: '+400 kcal' },
];

export default function ProfilePage() {
  const toast = useToast();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Shown as pills on the My foods / My exercises rows, so the page says how
  // much you've built up without having to open either.
  const [counts, setCounts] = useState<{
    foods: number | null;
    exercises: number | null;
  }>({ foods: null, exercises: null });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const p = await fetchProfile();
        if (!cancelled) setProfile(p);
      } catch {
        if (!cancelled) toast.error('Could not load your profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Counts load separately: they're decoration, so a slow or failed response
    // must not hold up (or break) the profile itself.
    void (async () => {
      const [foods, exercises] = await Promise.all([
        fetchFoods({ mode: 'mine', limit: 200 }).catch(() => null),
        fetchExercises({ mode: 'mine', limit: 200 }).catch(() => null),
      ]);
      if (cancelled) return;
      setCounts({
        foods: foods?.length ?? null,
        exercises: exercises?.length ?? null,
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      setProfile(await updateProfile(patch));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <TopBar title="Profile" showProfile={false} />
        <Spinner />
      </>
    );
  }

  if (!profile) return null;

  const manualGoal = profile.calorieGoalManual != null;

  return (
    <>
      <TopBar title="Profile" showProfile={false} />

      <div className="flex flex-col gap-3 pb-4">
        {/* Who you're signed in as. */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              {(profile.name?.trim()?.[0] ?? profile.email[0]).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {profile.name?.trim() || 'Your account'}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {profile.email}
              </p>
            </div>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Display name
            </span>
            <input
              defaultValue={profile.name ?? ''}
              placeholder="Your name"
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next !== (profile.name ?? '')) void save({ name: next || null });
              }}
              className="h-12 w-full rounded-xl border border-slate-300 px-3 text-base dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        </Card>

        {/* Computed summary — the payoff for filling in the body stats. */}
        <Card>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Summary label="BMR" value={profile.bmr} unit="kcal" />
            <Summary label="TDEE" value={profile.tdee} unit="kcal" />
            <Summary label="Goal" value={profile.calorieGoal} unit="kcal" strong />
          </div>
          {profile.bmi != null && (
            <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
              BMI {profile.bmi} · {profile.bmiCategory}
              <span className="ml-1 text-slate-400">(Indian cut-offs)</span>
            </p>
          )}
          {profile.bmr == null && (
            <p className="mt-3 text-center text-xs text-amber-700 dark:text-amber-300">
              Fill in sex, birth year, height and weight to get your numbers.
            </p>
          )}
        </Card>

        {/* Body */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Body</h2>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              {(['male', 'female'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void save({ sex: s })}
                  className={`min-h-12 flex-1 rounded-xl text-sm font-medium capitalize ${
                    profile.sex === s
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <NumberField
              label="Birth year"
              value={profile.birthYear}
              placeholder="1992"
              onCommit={(v) => void save({ birthYear: v })}
            />
            <NumberField
              label="Height (cm)"
              value={profile.heightCm}
              placeholder="175"
              onCommit={(v) => void save({ heightCm: v })}
            />
            <NumberField
              label="Weight (kg)"
              value={profile.weightKg}
              step="0.1"
              placeholder="74"
              hint="Also used for exercise calorie burn."
              onCommit={(v) => void save({ weightKg: v })}
            />
          </div>
        </Card>

        {/* Activity */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Activity level</h2>
          <div className="flex flex-col gap-2">
            {ACTIVITY_ORDER.map((level) => {
              const { title, blurb } = ACTIVITY_LABELS[level];
              const active = profile.activityLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => void save({ activityLevel: level })}
                  className={`rounded-xl p-3 text-left transition ${
                    active
                      ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-900/30'
                      : 'bg-slate-50 dark:bg-slate-800/60'
                  }`}
                >
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {blurb}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Goal */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Goal</h2>
          <div className="flex gap-2">
            {GOALS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => void save({ goalMode: g.id, calorieGoalManual: null })}
                className={`min-h-14 flex-1 rounded-xl text-sm font-medium ${
                  !manualGoal && profile.goalMode === g.id
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <span className="block">{g.label}</span>
                <span className="block text-[10px] opacity-70">{g.hint}</span>
              </button>
            ))}
          </div>

          <div className="mt-3">
            <NumberField
              label="Or set a calorie goal yourself"
              value={profile.calorieGoalManual}
              placeholder={profile.tdee ? String(profile.tdee) : '2000'}
              hint={manualGoal ? 'Overrides the calculated goal. Clear it to go back.' : undefined}
              onCommit={(v) => void save({ calorieGoalManual: v })}
            />
          </div>
        </Card>

        {/* Macro targets */}
        {profile.macroTargets && (
          <Card>
            <h2 className="mb-1 text-sm font-semibold">Macro targets</h2>
            <p className="mb-3 text-xs text-slate-500">
              Calculated from your goal — override any of them.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Protein (g)" value={profile.proteinGoalG} placeholder={String(profile.macroTargets.proteinG)} onCommit={(v) => void save({ proteinGoalG: v })} />
              <NumberField label="Carbs (g)" value={profile.carbGoalG} placeholder={String(profile.macroTargets.carbG)} onCommit={(v) => void save({ carbGoalG: v })} />
              <NumberField label="Fat (g)" value={profile.fatGoalG} placeholder={String(profile.macroTargets.fatG)} onCommit={(v) => void save({ fatGoalG: v })} />
              <NumberField label="Fibre (g)" value={profile.fibreGoalG} placeholder={String(profile.macroTargets.fibreG)} onCommit={(v) => void save({ fibreGoalG: v })} />
            </div>
          </Card>
        )}

        {/* Water */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Water</h2>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Daily target (ml)"
              value={profile.waterTargetMl}
              placeholder="3000"
              onCommit={(v) => void save({ waterTargetMl: v })}
            />
            <NumberField
              label="Glass size (ml)"
              value={profile.glassSizeMl}
              placeholder="250"
              onCommit={(v) => void save({ glassSizeMl: v })}
            />
          </div>
        </Card>

        {/* Manage */}
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Manage</h2>
          <div className="flex flex-col">
            <RowLink href="/profile/slots" label="Meal slots" hint="Rename, reorder, add" />
            <RowLink
              href="/profile/foods"
              label="My foods"
              hint="Add, edit or remove your own foods"
              count={counts.foods}
            />
            <RowLink
              href="/profile/exercises"
              label="My exercises"
              hint="Add, edit or remove your own exercises"
              count={counts.exercises}
            />
            <a
              href="/api/export"
              className="flex min-h-14 items-center gap-2 border-t border-slate-100 py-3 text-sm dark:border-slate-800"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Export a backup</span>
                <span className="block text-xs text-slate-500">
                  Download everything as JSON
                </span>
              </span>
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </Card>

        <button
          type="button"
          onClick={() => void logout()}
          className="min-h-14 w-full rounded-2xl bg-white text-sm font-semibold text-rose-600 shadow-sm dark:bg-slate-900 dark:text-rose-400"
        >
          Sign out
        </button>

        {saving && <p className="text-center text-xs text-slate-400">Saving…</p>}
      </div>
    </>
  );
}

function Summary({
  label,
  value,
  unit,
  strong,
}: {
  label: string;
  value: number | null;
  unit: string;
  strong?: boolean;
}) {
  return (
    <div>
      <div
        className={`tabular-nums ${strong ? 'text-2xl font-semibold text-brand-600 dark:text-brand-400' : 'text-lg font-medium'}`}
      >
        {value ?? '—'}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">
        {label} {unit}
      </div>
    </div>
  );
}

/**
 * Number input that commits on blur rather than per keystroke — otherwise every
 * digit fires a PATCH and the intermediate values are nonsense.
 */
function NumberField({
  label,
  value,
  onCommit,
  placeholder,
  step = '1',
  hint,
}: {
  label: string;
  value: number | null;
  onCommit: (value: number | null) => void;
  placeholder?: string;
  step?: string;
  hint?: string;
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : '');
  // Adjust the draft when the saved value changes underneath us (e.g. after a
  // PATCH returns a rounded number). Done during render rather than in an
  // effect, which is React's documented pattern and avoids a cascading render.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value != null ? String(value) : '');
  }

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const trimmed = draft.trim();
          if (trimmed === '') {
            if (value != null) onCommit(null);
            return;
          }
          const n = Number(trimmed);
          if (Number.isFinite(n) && n !== value) onCommit(n);
        }}
        className="h-12 w-full rounded-xl border border-slate-300 px-3 text-base tabular-nums dark:border-slate-700 dark:bg-slate-800"
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function RowLink({
  href,
  label,
  hint,
  count,
}: {
  href: string;
  label: string;
  hint: string;
  /** Shown as a pill on the right. null while still loading. */
  count?: number | null;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center gap-2 border-t border-slate-100 py-3 text-sm first:border-t-0 dark:border-slate-800"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
      {count != null && count > 0 && (
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {count}
        </span>
      )}
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
