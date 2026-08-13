'use client';

import { useEffect, useState } from 'react';

import { TopBar } from '@/components/nav/TopBar';
import { Card, Spinner } from '@/components/ui/EmptyState';
import { MacroBar } from '@/components/ui/MacroBar';
import { WeightChart } from '@/components/weight/WeightChart';
import { fetchHistory, fetchProfile, fetchWeightTrend } from '@/lib/api';
import { addDays, localDayKey } from '@/lib/calc/dates';
import { currentStreak } from '@/lib/calc/trend';
import type { HistoryDayDto, ProfileDto, WeightTrendDto } from '@/types/dto';

const RANGES = [7, 30, 90] as const;

/** Trends: weight, calories in vs out, macro averages, water. */
export default function StatsPage() {
  const [range, setRange] = useState<number>(30);
  const [days, setDays] = useState<HistoryDayDto[]>([]);
  const [trend, setTrend] = useState<WeightTrendDto | null>(null);
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const today = localDayKey();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [d, t, p] = await Promise.all([
          fetchHistory(range),
          fetchWeightTrend(range),
          fetchProfile(),
        ]);
        if (cancelled) return;
        setDays(d);
        setTrend(t);
        setProfile(p);
      } catch {
        // Stats are read-only; a failed load just leaves the empty states.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const withFood = days.filter((d) => d.entryCount > 0);
  const avg = (pick: (d: HistoryDayDto) => number) =>
    withFood.length === 0
      ? 0
      : withFood.reduce((s, d) => s + pick(d), 0) / withFood.length;

  const maxBar = Math.max(
    1,
    ...days.map((d) => Math.max(d.kcalIn, d.kcalOut, d.goalKcal ?? 0)),
  );

  const waterStreak = currentStreak(
    days.map((d) => ({ dayKey: d.dayKey, value: d.waterMl })),
    (ml) => ml >= (profile?.waterTargetMl ?? 3000),
    today,
  );

  return (
    <>
      <TopBar title="Stats" />

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${
              range === r
                ? 'bg-brand-500 text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {r} days
          </button>
        ))}
      </div>

      {loading && days.length === 0 && <Spinner />}

      <div className="flex flex-col gap-3">
        {/* Weight trend */}
        <Card>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Weight</h2>
            {trend?.changeKg != null && trend.spanDays > 0 && (
              <span
                className={`text-xs font-semibold tabular-nums ${
                  trend.changeKg < 0
                    ? 'text-fibre'
                    : trend.changeKg > 0
                      ? 'text-amber-600'
                      : 'text-slate-500'
                }`}
              >
                {trend.changeKg > 0 ? '+' : ''}
                {trend.changeKg.toFixed(1)} kg in {trend.spanDays}d
              </span>
            )}
          </div>
          <WeightChart
            points={(trend?.logs ?? []).map((l) => ({
              dayKey: l.dayKey,
              value: l.weightKg,
            }))}
            average={(trend?.movingAvg7 ?? []).map((p) => ({
              dayKey: p.dayKey,
              value: p.kg,
            }))}
            from={addDays(today, -(range - 1))}
            to={today}
          />
          {(trend?.logs.length ?? 0) > 1 && (
            <p className="mt-2 text-center text-[10px] text-slate-400">
              Solid line is the 7-day average — it shows the trend through daily noise.
            </p>
          )}
        </Card>

        {/* Calories in vs out */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Calories in vs out</h2>
          {days.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No data yet.</p>
          ) : (
            <>
              <div className="flex h-32 items-end gap-[3px]">
                {[...days].reverse().map((d) => (
                  <div
                    key={d.dayKey}
                    className="flex h-full min-w-0 flex-1 flex-col justify-end gap-[2px]"
                    title={`${d.dayKey}: in ${Math.round(d.kcalIn)}, out ${Math.round(d.kcalOut)}`}
                  >
                    <div
                      className="w-full rounded-t bg-brand-400"
                      style={{ height: `${(d.kcalIn / maxBar) * 100}%` }}
                    />
                    {d.kcalOut > 0 && (
                      <div
                        className="w-full rounded-b"
                        style={{
                          height: `${(d.kcalOut / maxBar) * 100}%`,
                          backgroundColor: 'var(--color-fibre)',
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-center gap-4 text-[10px] text-slate-500">
                <Legend color="var(--color-brand-400)" label="Eaten" />
                <Legend color="var(--color-fibre)" label="Burned" />
              </div>
              <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                Average {Math.round(avg((d) => d.kcalIn))} kcal eaten
                {profile?.calorieGoal != null && ` · goal ${profile.calorieGoal}`}
              </p>
            </>
          )}
        </Card>

        {/* Macro averages */}
        {profile?.macroTargets && withFood.length > 0 && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold">
              Daily averages{' '}
              <span className="font-normal text-slate-400">
                ({withFood.length} logged {withFood.length === 1 ? 'day' : 'days'})
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <MacroBar label="Protein" used={avg((d) => d.proteinG)} target={profile.macroTargets.proteinG} tone="protein" />
              <MacroBar label="Carbs" used={avg((d) => d.carbG)} target={profile.macroTargets.carbG} tone="carb" />
              <MacroBar label="Fat" used={avg((d) => d.fatG)} target={profile.macroTargets.fatG} tone="fat" />
              <MacroBar label="Fibre" used={avg((d) => d.fibreG)} target={profile.macroTargets.fibreG} tone="fibre" />
            </div>
          </Card>
        )}

        {/* Water */}
        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Water</h2>
            {waterStreak > 0 && (
              <span className="text-xs font-semibold text-water">
                {waterStreak}-day streak
              </span>
            )}
          </div>
          {days.some((d) => d.waterMl > 0) ? (
            <div className="flex h-20 items-end gap-[3px]">
              {[...days].reverse().map((d) => {
                const target = profile?.waterTargetMl ?? 3000;
                const pct = Math.min(100, (d.waterMl / target) * 100);
                return (
                  <div
                    key={d.dayKey}
                    className="min-w-0 flex-1 rounded-t"
                    style={{
                      height: `${Math.max(2, pct)}%`,
                      backgroundColor:
                        d.waterMl >= target
                          ? 'var(--color-water)'
                          : 'color-mix(in oklch, var(--color-water) 40%, transparent)',
                    }}
                    title={`${d.dayKey}: ${(d.waterMl / 1000).toFixed(1)}L`}
                  />
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-slate-500">
              No water logged yet.
            </p>
          )}
        </Card>

        {/* Exercise summary */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Exercise</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat
              label="Sessions"
              value={days.reduce((s, d) => s + d.exerciseCount, 0)}
            />
            <MiniStat
              label="Minutes"
              value={Math.round(days.reduce((s, d) => s + d.exerciseMinutes, 0))}
            />
            <MiniStat
              label="kcal"
              value={Math.round(days.reduce((s, d) => s + d.kcalOut, 0))}
            />
          </div>
        </Card>
      </div>
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="inline-block h-2 w-2 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}
