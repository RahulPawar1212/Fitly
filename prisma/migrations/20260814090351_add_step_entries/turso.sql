-- Turso-safe equivalent of migration.sql.
--
-- Prisma generated a full table rebuild (CREATE new / INSERT SELECT / DROP /
-- RENAME) because that is how it adds columns to SQLite in the general case. The
-- rebuild is correct, but running it against a database holding real entries
-- means dropping and recreating the table — a needlessly risky operation when the
-- change is purely additive.
--
-- All three columns are nullable or defaulted, so plain ALTER TABLE ADD COLUMN
-- does the same job without ever dropping anything. This is the version applied
-- to Turso; `npm run db:push:turso` prefers turso.sql when present.
--
-- SQLite has no ADD COLUMN IF NOT EXISTS, so re-running this errors with
-- "duplicate column name" — which is harmless and means it was already applied.

ALTER TABLE "ExerciseEntry" ADD COLUMN "steps" INTEGER;
ALTER TABLE "ExerciseEntry" ADD COLUMN "distanceKm" REAL;
ALTER TABLE "ExerciseEntry" ADD COLUMN "minutesEstimated" BOOLEAN NOT NULL DEFAULT false;
