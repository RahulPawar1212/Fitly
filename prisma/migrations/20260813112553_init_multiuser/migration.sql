-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "sex" TEXT NOT NULL DEFAULT 'male',
    "birthYear" INTEGER,
    "heightCm" REAL,
    "weightKg" REAL,
    "activityLevel" TEXT NOT NULL DEFAULT 'moderate',
    "goalMode" TEXT NOT NULL DEFAULT 'maintain',
    "calorieGoalManual" INTEGER,
    "proteinGoalG" INTEGER,
    "carbGoalG" INTEGER,
    "fatGoalG" INTEGER,
    "fibreGoalG" INTEGER,
    "waterTargetMl" INTEGER NOT NULL DEFAULT 3000,
    "glassSizeMl" INTEGER NOT NULL DEFAULT 250,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MealSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MealSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Food" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "nameLower" TEXT NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "cuisine" TEXT NOT NULL DEFAULT 'indian',
    "servingLabel" TEXT NOT NULL,
    "servingGrams" REAL,
    "kcal" REAL NOT NULL,
    "proteinG" REAL NOT NULL,
    "carbG" REAL NOT NULL,
    "fatG" REAL NOT NULL,
    "fibreG" REAL NOT NULL,
    "isVeg" BOOLEAN NOT NULL DEFAULT true,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Food_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FoodUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FoodUsage_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FoodEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "mealSlotId" TEXT NOT NULL,
    "foodId" TEXT,
    "servings" REAL NOT NULL DEFAULT 1,
    "nameSnapshot" TEXT NOT NULL,
    "servingLabelSnapshot" TEXT NOT NULL,
    "kcalPerServing" REAL NOT NULL,
    "proteinPerServing" REAL NOT NULL,
    "carbPerServing" REAL NOT NULL,
    "fatPerServing" REAL NOT NULL,
    "fibrePerServing" REAL NOT NULL,
    "note" TEXT,
    "loggedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FoodEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FoodEntry_mealSlotId_fkey" FOREIGN KEY ("mealSlotId") REFERENCES "MealSlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FoodEntry_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "nameLower" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "met" REAL NOT NULL,
    "intensity" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Exercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExerciseUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExerciseUsage_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExerciseEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "exerciseId" TEXT,
    "minutes" REAL NOT NULL,
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

-- CreateTable
CREATE TABLE "WaterLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "ml" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WaterLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeightLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "weightKg" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeightLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "MealSlot_userId_isActive_sortOrder_idx" ON "MealSlot"("userId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MealSlot_userId_key_key" ON "MealSlot"("userId", "key");

-- CreateIndex
CREATE INDEX "Food_userId_idx" ON "Food"("userId");

-- CreateIndex
CREATE INDEX "Food_nameLower_idx" ON "Food"("nameLower");

-- CreateIndex
CREATE INDEX "Food_category_idx" ON "Food"("category");

-- CreateIndex
CREATE INDEX "Food_isArchived_idx" ON "Food"("isArchived");

-- CreateIndex
CREATE INDEX "FoodUsage_userId_lastUsedAt_idx" ON "FoodUsage"("userId", "lastUsedAt");

-- CreateIndex
CREATE INDEX "FoodUsage_userId_usageCount_idx" ON "FoodUsage"("userId", "usageCount");

-- CreateIndex
CREATE UNIQUE INDEX "FoodUsage_userId_foodId_key" ON "FoodUsage"("userId", "foodId");

-- CreateIndex
CREATE INDEX "FoodEntry_userId_dayKey_idx" ON "FoodEntry"("userId", "dayKey");

-- CreateIndex
CREATE INDEX "FoodEntry_userId_dayKey_mealSlotId_idx" ON "FoodEntry"("userId", "dayKey", "mealSlotId");

-- CreateIndex
CREATE INDEX "FoodEntry_foodId_idx" ON "FoodEntry"("foodId");

-- CreateIndex
CREATE INDEX "Exercise_userId_idx" ON "Exercise"("userId");

-- CreateIndex
CREATE INDEX "Exercise_nameLower_idx" ON "Exercise"("nameLower");

-- CreateIndex
CREATE INDEX "Exercise_category_idx" ON "Exercise"("category");

-- CreateIndex
CREATE INDEX "Exercise_isArchived_idx" ON "Exercise"("isArchived");

-- CreateIndex
CREATE INDEX "ExerciseUsage_userId_lastUsedAt_idx" ON "ExerciseUsage"("userId", "lastUsedAt");

-- CreateIndex
CREATE INDEX "ExerciseUsage_userId_usageCount_idx" ON "ExerciseUsage"("userId", "usageCount");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseUsage_userId_exerciseId_key" ON "ExerciseUsage"("userId", "exerciseId");

-- CreateIndex
CREATE INDEX "ExerciseEntry_userId_dayKey_idx" ON "ExerciseEntry"("userId", "dayKey");

-- CreateIndex
CREATE INDEX "ExerciseEntry_exerciseId_idx" ON "ExerciseEntry"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "WaterLog_userId_dayKey_key" ON "WaterLog"("userId", "dayKey");

-- CreateIndex
CREATE INDEX "WeightLog_userId_dayKey_idx" ON "WeightLog"("userId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "WeightLog_userId_dayKey_key" ON "WeightLog"("userId", "dayKey");
