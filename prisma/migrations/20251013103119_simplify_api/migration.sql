/*
  Warnings:

  - You are about to drop the `onboarding` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "onboarding_userId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "onboarding";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "gender" TEXT,
    "provider" TEXT,
    "providerId" TEXT,
    "passwordHash" TEXT,
    "deviceId" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "language" TEXT,
    "timezone" TEXT,
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ageRange" TEXT,
    "vibeLevel" INTEGER NOT NULL DEFAULT 0,
    "timeInvestmentHours" INTEGER NOT NULL DEFAULT 0,
    "tosVersion" TEXT,
    "privacyVersion" TEXT,
    "onboardedAt" DATETIME,
    "eloRating" REAL NOT NULL DEFAULT 1500.0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "normalCount" INTEGER NOT NULL DEFAULT 0,
    "totalRatings" INTEGER NOT NULL DEFAULT 0,
    "lastRatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_users" ("avatar", "bio", "createdAt", "deletedAt", "deviceId", "eloRating", "email", "gender", "id", "isDeleted", "isGuest", "language", "lastRatedAt", "likeCount", "location", "name", "normalCount", "notificationsEnabled", "passwordHash", "provider", "providerId", "timezone", "totalRatings", "totalScore", "updatedAt") SELECT "avatar", "bio", "createdAt", "deletedAt", "deviceId", "eloRating", "email", "gender", "id", "isDeleted", "isGuest", "language", "lastRatedAt", "likeCount", "location", "name", "normalCount", "notificationsEnabled", "passwordHash", "provider", "providerId", "timezone", "totalRatings", "totalScore", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_eloRating_idx" ON "users"("eloRating" DESC);
CREATE INDEX "users_totalScore_idx" ON "users"("totalScore" DESC);
CREATE INDEX "users_gender_eloRating_idx" ON "users"("gender", "eloRating" DESC);
CREATE INDEX "users_isGuest_isDeleted_eloRating_idx" ON "users"("isGuest", "isDeleted", "eloRating" DESC);
CREATE INDEX "users_isDeleted_lastRatedAt_idx" ON "users"("isDeleted", "lastRatedAt" DESC);
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt" DESC);
CREATE UNIQUE INDEX "users_provider_providerId_key" ON "users"("provider", "providerId");
CREATE UNIQUE INDEX "users_deviceId_key" ON "users"("deviceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
