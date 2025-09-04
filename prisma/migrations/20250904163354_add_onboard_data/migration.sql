-- CreateTable
CREATE TABLE "onboarding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ageRange" TEXT NOT NULL,
    "vibeLevel" INTEGER NOT NULL,
    "timeInvestmentHours" INTEGER NOT NULL,
    "notificationsEnabled" BOOLEAN NOT NULL,
    "tosVersion" TEXT NOT NULL,
    "privacyVersion" TEXT NOT NULL,
    "acceptedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "onboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "gender" TEXT,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "passwordHash" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "language" TEXT,
    "timezone" TEXT,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("avatar", "createdAt", "email", "gender", "id", "name", "passwordHash", "provider", "providerId", "updatedAt") SELECT "avatar", "createdAt", "email", "gender", "id", "name", "passwordHash", "provider", "providerId", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_provider_providerId_key" ON "users"("provider", "providerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_userId_key" ON "onboarding"("userId");
