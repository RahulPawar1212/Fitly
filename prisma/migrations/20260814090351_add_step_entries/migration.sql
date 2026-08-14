-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExerciseEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "exerciseId" TEXT,
    "minutes" REAL NOT NULL,
    "steps" INTEGER,
    "distanceKm" REAL,
    "minutesEstimated" BOOLEAN NOT NULL DEFAULT false,
    "nameSnapshot" TEXT NOT NULL,
    "metSnapshot" REAL NOT NULL,
    "bodyWeightKgSnapshot" REAL NOT NULL,
    "kcalBurned" REAL NOT NULL,
    "note" TEXT,
    "loggedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExerciseEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExerciseEntry_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ExerciseEntry" ("bodyWeightKgSnapshot", "createdAt", "dayKey", "exerciseId", "id", "kcalBurned", "loggedAt", "metSnapshot", "minutes", "nameSnapshot", "note", "updatedAt", "userId") SELECT "bodyWeightKgSnapshot", "createdAt", "dayKey", "exerciseId", "id", "kcalBurned", "loggedAt", "metSnapshot", "minutes", "nameSnapshot", "note", "updatedAt", "userId" FROM "ExerciseEntry";
DROP TABLE "ExerciseEntry";
ALTER TABLE "new_ExerciseEntry" RENAME TO "ExerciseEntry";
CREATE INDEX "ExerciseEntry_userId_dayKey_idx" ON "ExerciseEntry"("userId", "dayKey");
CREATE INDEX "ExerciseEntry_exerciseId_idx" ON "ExerciseEntry"("exerciseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
