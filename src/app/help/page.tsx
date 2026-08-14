import Link from 'next/link';
import type { ReactNode } from 'react';

import { TopBar } from '@/components/nav/TopBar';

export const metadata = { title: 'Help · Fitzora' };

/**
 * In-app help.
 *
 * A static server component on purpose — no data fetching, so it works even when
 * something else is broken, and it can be read before signing in.
 *
 * Written in plain language: the reader is someone using the app, not someone
 * reading the codebase. Jargon that cannot be avoided (MET, BMR, TDEE) is
 * explained where it first appears.
 */
export default function HelpPage() {
  return (
    <>
      {/* Back to the home screen, not to Profile: the "?" in the header means
          Help can be opened from any tab now. */}
      <TopBar
        title="How Fitzora works"
        back="/"
        showHelp={false}
        showHistory={false}
        showProfile={false}
      />

      <div className="flex flex-col gap-3 pb-6">
        <Card>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Fitzora tracks what you eat and what you burn, in the units Indian food
            is actually served in — <strong>2 rotis</strong>, <strong>1 katori of
            dal</strong>, <strong>1 cup of chai</strong> — rather than grams.
          </p>
        </Card>

        {/* ---------------------------------------------------------------- */}
        <Section title="Getting started" emoji="🚀">
          <Step n={1} title="Fill in your body details">
            Open <Ref>Profile</Ref> and set your <strong>sex, birth year, height
            and weight</strong>. Everything else depends on these four.
          </Step>
          <Step n={2} title="Your goal appears by itself">
            As soon as those are filled in, your daily calorie goal is calculated
            and the ring on the home screen starts working. There is nothing extra
            to press.
          </Step>
          <Step n={3} title="Start logging">
            Tap the big <strong>+</strong> in the middle of the bottom bar, search
            for a food, and tap <strong>+</strong> on the row.
          </Step>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section title="What “Set a goal” means" emoji="🎯">
          <P>
            It is your <strong>daily calorie target</strong> — the number the ring
            fills up against. Until it exists, the ring has nothing to measure, so
            it shows <Ref>Set a goal →</Ref> instead.
          </P>
          <P>You never have to work the number out. From your details the app finds:</P>
          <Bullets>
            <li>
              <strong>BMR</strong> — the calories your body uses at complete rest,
              just staying alive.
            </li>
            <li>
              <strong>TDEE</strong> — your BMR plus everyday movement, based on the
              activity level you pick. This is roughly what you burn in a day.
            </li>
            <li>
              <strong>Your goal</strong> — TDEE if you want to maintain weight,
              about 500 less to lose, about 400 more to gain.
            </li>
          </Bullets>
          <Example>
            A 34-year-old man, 175 cm, 74 kg, moderately active:
            <br />
            BMR <strong>1669</strong> → TDEE <strong>2587</strong> → goal{' '}
            <strong>2587 kcal</strong>
          </Example>
          <P>
            Prefer to name your own number? <Ref>Profile → Or set a calorie goal
            yourself</Ref> overrides the calculation completely. Clear the field to
            go back to the calculated one.
          </P>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section title="Reading the ring" emoji="⭕">
          <P>
            The big number in the middle is your <strong>net calories</strong>:
          </P>
          <Formula>eaten − burned = net</Formula>
          <P>
            So a 40-minute walk genuinely buys back room for a snack. Underneath,{' '}
            <strong>Eaten</strong>, <strong>Burned</strong> and <strong>Net</strong>{' '}
            show the three parts separately.
          </P>
          <Bullets>
            <li>The ring fills as you eat.</li>
            <li>It turns <span className="font-semibold text-amber-600 dark:text-amber-400">amber</span> past 90% of your goal.</li>
            <li>It turns <span className="font-semibold text-rose-600 dark:text-rose-400">red</span> once you go over.</li>
          </Bullets>
          <P>
            Going over is information, not a failure. One day above your goal
            changes very little; the trend over weeks is what matters.
          </P>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section title="Logging food" emoji="🍛">
          <P>
            Tap <strong>+</strong> in the bottom bar, or the small <strong>+</strong>{' '}
            on any meal card to go straight to that meal.
          </P>
          <Bullets>
            <li>
              <strong>Tap + on a row</strong> to add one serving instantly. A short{' '}
              <Ref>Undo</Ref> appears in case you hit the wrong one.
            </li>
            <li>
              <strong>Tap the name</strong> instead to choose an amount — 2 rotis,
              half a katori — and see the calories update as you change it.
            </li>
            <li>
              The meal is <strong>chosen for you by the time of day</strong>. At
              1pm it picks Lunch. One tap on a different chip changes it.
            </li>
            <li>
              Search understands common names: type <em>chapati</em> and Roti
              appears.
            </li>
          </Bullets>
          <Callout>
            Missing something? Search for it, then tap{' '}
            <Ref>Create “…”</Ref> at the top of the results and enter your own
            calories. Or add foods up front in{' '}
            <Ref>Profile → My foods</Ref>.
          </Callout>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section title="Fixing a mistake" emoji="✏️">
          <Bullets>
            <li>
              <strong>Remove an item</strong> — tap the <strong>×</strong> at the
              right of any logged row. An <Ref>Undo</Ref> appears for a few seconds.
            </li>
            <li>
              <strong>Change the amount, or move it to another meal</strong> — tap
              the row itself.
            </li>
            <li>
              <strong>Fix a past day</strong> — go to <Ref>Diary</Ref> and pick the
              date from the strip along the top.
            </li>
          </Bullets>
          <P>
            History pages are read-only on purpose, so looking back at an old day
            can never change it by accident.
          </P>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section title="Logging exercise" emoji="🏃">
          <P>
            Open <Ref>Exercise</Ref>, tap <Ref>Log exercise</Ref>, pick an activity
            and enter how many minutes. That is all — the calories are worked out
            for you.
          </P>
          <P>
            Each activity carries a <strong>MET</strong> value: simply how hard it
            is compared with sitting still. Walking is about 4, running about 9.
            Burn is then:
          </P>
          <Formula>MET × 3.5 × your weight (kg) ÷ 200 × minutes</Formula>
          <Example>
            Running at 8 km/h for 30 minutes at 74 kg → <strong>322 kcal</strong>
          </Example>
          <Callout tone="warn">
            This uses your <strong>weight</strong>, so exercise cannot be logged
            until you have set it in Profile. A heavier body burns more for the
            same work — that is real, not a quirk.
          </Callout>
          <P>
            Your gym circuit not in the list? Add it in{' '}
            <Ref>Profile → My exercises</Ref>. The form shows what your chosen
            intensity works out to in calories per minute, so you can sanity-check
            the number.
          </P>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section title="Logging steps" emoji="👣">
          <P>
            <Ref>Exercise → Log steps</Ref>. Type the number and Fitzora works out
            the distance and calories.
          </P>
          <Example>
            8,420 steps at 175 cm and 74 kg → <strong>6.1 km</strong>,{' '}
            <strong>~347 kcal</strong>
          </Example>
          <Bullets>
            <li>
              <strong>Distance</strong> comes from your height — a taller person
              covers more ground per step. Set your height in Profile for a better
              figure.
            </li>
            <li>
              <strong>Minutes are optional.</strong> Add them if you know them and
              the calorie estimate improves, because a brisk walk burns more per
              minute than a stroll. Left blank, the duration is estimated at an
              average pace and clearly marked <em>(est.)</em>.
            </li>
            <li>
              Got the number wrong? Tap the entry to correct it, or the{' '}
              <strong>×</strong> to remove it.
            </li>
          </Bullets>
          <Callout tone="warn">
            <strong>Where the step number comes from.</strong> Fitzora cannot count
            steps itself. A website is not allowed to read the motion sensor while
            the screen is off — the browser stops sending that data the moment the
            page is hidden, so any in-app counter would silently miss most of your
            walk. Your phone&apos;s built-in health app and fitness bands do not
            have that limitation, because they run at the operating-system level.
            So read the number from there and enter it here.
          </Callout>
          <P>
            On Android that is <strong>Google Fit</strong>, <strong>Samsung
            Health</strong> or your phone&apos;s own health app; on iPhone it is{' '}
            <strong>Health</strong>, which counts steps automatically with no setup.
          </P>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section title="The other numbers" emoji="📊">
          <Bullets>
            <li>
              <strong>Macros</strong> — protein, carbs, fat and fibre. Protein is
              set from your body weight (useful if you train); the rest follow from
              your calorie goal. Every one can be overridden in Profile.
            </li>
            <li>
              <strong>Water</strong> — tap <Ref>+1 glass</Ref>. Glass size and daily
              target are both adjustable.
            </li>
            <li>
              <strong>Weight</strong> — log it whenever you weigh yourself.{' '}
              <Ref>Stats</Ref> draws the trend with a 7-day average line, which is
              the one to watch: day-to-day changes are mostly water, not fat.
            </li>
            <li>
              <strong>BMI</strong> — shown in Profile, using the Indian cut-offs
              (overweight from 23, not 25).
            </li>
          </Bullets>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section title="Getting around" emoji="🧭">
          <Bullets>
            <li><strong>Today</strong> — the ring, your meals, water and weight.</li>
            <li><strong>Diary</strong> — any day in full detail, and where you edit.</li>
            <li><strong>+</strong> — add food, from anywhere.</li>
            <li><strong>Exercise</strong> — log and review workouts.</li>
            <li><strong>Stats</strong> — trends over 7, 30 or 90 days.</li>
          </Bullets>
          <P>
            The calendar and profile icons at the top right lead to{' '}
            <strong>History</strong> and <strong>Profile</strong>.
          </P>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section title="Good to know" emoji="💡">
          <Bullets>
            <li>
              <strong>Editing a food never rewrites the past.</strong> Correcting a
              food&apos;s calories today leaves meals you already logged exactly as
              they were.
            </li>
            <li>
              <strong>Your data is yours.</strong> Each account sees only its own
              meals, weight and custom foods. The food database is the only thing
              shared.
            </li>
            <li>
              <strong>Take a backup.</strong>{' '}
              <Ref>Profile → Export a backup</Ref> downloads everything as a file.
              Worth doing now and then.
            </li>
            <li>
              <strong>Install it.</strong> In your phone&apos;s browser menu choose{' '}
              <em>Add to Home Screen</em> and it opens like a normal app.
            </li>
          </Bullets>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section title="Serving sizes" emoji="🥣">
          <P>Where the built-in foods are concerned:</P>
          <Bullets>
            <li><strong>1 katori</strong> — a small steel bowl, about 150 ml. Dal, sabzi, curd.</li>
            <li><strong>1 roti</strong> — a medium chapati, roughly 40 g.</li>
            <li><strong>1 cup</strong> — 150 ml, as chai is normally served.</li>
            <li><strong>1 plate</strong> — a full serving, as of biryani.</li>
          </Bullets>
          <P>
            These are the values used across the 236 built-in foods. If your portion
            is bigger, log 1.5 or 2 servings rather than trying to be exact —
            consistency matters more than precision.
          </P>
        </Section>

        <Card>
          <h2 className="mb-2 text-sm font-semibold">Still stuck?</h2>
          <P>
            The one thing genuinely worth getting right is your{' '}
            <strong>weight in Profile</strong> — the goal and every burn figure come
            from it. Everything else can be adjusted as you go.
          </P>
          <Link
            href="/profile"
            className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-brand-500 text-sm font-semibold text-white"
          >
            Open Profile
          </Link>
        </Card>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ pieces */

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
      {children}
    </section>
  );
}

function Section({
  title,
  emoji,
  children,
}: {
  title: string;
  emoji: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <span aria-hidden>{emoji}</span>
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </Card>
  );
}

function P({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      {children}
    </p>
  );
}

function Bullets({ children }: { children: ReactNode }) {
  return (
    <ul className="flex flex-col gap-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      {children}
    </ul>
  );
}

/** A numbered step, for the getting-started sequence. */
function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {children}
        </p>
      </div>
    </div>
  );
}

/** Names something the reader will see on screen. */
function Ref({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {children}
    </span>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-center text-sm font-medium tabular-nums text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
      {children}
    </p>
  );
}

function Example({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-brand-300 pl-3 text-sm leading-relaxed text-slate-600 dark:border-brand-700 dark:text-slate-300">
      {children}
    </p>
  );
}

function Callout({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warn';
}) {
  return (
    <p
      className={`rounded-xl px-3 py-2.5 text-sm leading-relaxed ${
        tone === 'warn'
          ? 'bg-amber-50 text-amber-900 dark:bg-amber-900/25 dark:text-amber-100'
          : 'bg-brand-50 text-brand-900 dark:bg-brand-900/25 dark:text-brand-100'
      }`}
    >
      {children}
    </p>
  );
}
