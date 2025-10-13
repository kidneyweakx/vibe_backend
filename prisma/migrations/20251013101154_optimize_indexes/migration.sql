/*
  Warnings:

  - You are about to alter the column `userId` on the `onboarding` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `userId` on the `photos` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `ratedUserId` on the `ratings` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `raterId` on the `ratings` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `reporterId` on the `reports` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `reviewedBy` on the `reports` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `users` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_onboarding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
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
INSERT INTO "new_onboarding" ("acceptedAt", "ageRange", "createdAt", "id", "notificationsEnabled", "privacyVersion", "timeInvestmentHours", "tosVersion", "updatedAt", "userId", "vibeLevel") SELECT "acceptedAt", "ageRange", "createdAt", "id", "notificationsEnabled", "privacyVersion", "timeInvestmentHours", "tosVersion", "updatedAt", "userId", "vibeLevel" FROM "onboarding";
DROP TABLE "onboarding";
ALTER TABLE "new_onboarding" RENAME TO "onboarding";
CREATE UNIQUE INDEX "onboarding_userId_key" ON "onboarding"("userId");
CREATE TABLE "new_photos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "isProfilePicture" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "hiddenAt" DATETIME,
    "hiddenReason" TEXT,
    "takenAt" DATETIME,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "photos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_photos" ("format", "hiddenAt", "hiddenReason", "id", "isProfilePicture", "key", "size", "status", "takenAt", "uploadedAt", "url", "userId") SELECT "format", "hiddenAt", "hiddenReason", "id", "isProfilePicture", "key", "size", "status", "takenAt", "uploadedAt", "url", "userId" FROM "photos";
DROP TABLE "photos";
ALTER TABLE "new_photos" RENAME TO "photos";
CREATE UNIQUE INDEX "photos_key_key" ON "photos"("key");
CREATE INDEX "photos_status_uploadedAt_idx" ON "photos"("status", "uploadedAt" DESC);
CREATE INDEX "photos_userId_status_takenAt_idx" ON "photos"("userId", "status", "takenAt" DESC);
CREATE INDEX "photos_userId_isProfilePicture_status_idx" ON "photos"("userId", "isProfilePicture", "status");
CREATE INDEX "photos_uploadedAt_idx" ON "photos"("uploadedAt" DESC);
CREATE TABLE "new_ratings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "raterId" INTEGER NOT NULL,
    "ratedUserId" INTEGER NOT NULL,
    "photoId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "raterEloAtTime" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ratings_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ratings_ratedUserId_fkey" FOREIGN KEY ("ratedUserId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ratings_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ratings" ("createdAt", "id", "photoId", "ratedUserId", "raterEloAtTime", "raterId", "type") SELECT "createdAt", "id", "photoId", "ratedUserId", "raterEloAtTime", "raterId", "type" FROM "ratings";
DROP TABLE "ratings";
ALTER TABLE "new_ratings" RENAME TO "ratings";
CREATE INDEX "ratings_raterId_type_createdAt_idx" ON "ratings"("raterId", "type", "createdAt" DESC);
CREATE INDEX "ratings_ratedUserId_createdAt_idx" ON "ratings"("ratedUserId", "createdAt" DESC);
CREATE INDEX "ratings_photoId_type_idx" ON "ratings"("photoId", "type");
CREATE INDEX "ratings_createdAt_idx" ON "ratings"("createdAt" DESC);
CREATE UNIQUE INDEX "ratings_raterId_photoId_key" ON "ratings"("raterId", "photoId");
CREATE TABLE "new_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "photoId" TEXT NOT NULL,
    "reporterId" INTEGER,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" DATETIME,
    "reviewedBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reports_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_reports" ("createdAt", "details", "id", "photoId", "reason", "reporterId", "reviewedAt", "reviewedBy", "status") SELECT "createdAt", "details", "id", "photoId", "reason", "reporterId", "reviewedAt", "reviewedBy", "status" FROM "reports";
DROP TABLE "reports";
ALTER TABLE "new_reports" RENAME TO "reports";
CREATE INDEX "reports_photoId_idx" ON "reports"("photoId");
CREATE INDEX "reports_reporterId_idx" ON "reports"("reporterId");
CREATE INDEX "reports_status_idx" ON "reports"("status");
CREATE UNIQUE INDEX "reports_photoId_reporterId_key" ON "reports"("photoId", "reporterId");
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
INSERT INTO "new_users" ("avatar", "bio", "createdAt", "eloRating", "email", "gender", "id", "isGuest", "language", "lastRatedAt", "likeCount", "location", "name", "normalCount", "notificationsEnabled", "passwordHash", "provider", "providerId", "timezone", "totalRatings", "totalScore", "updatedAt") SELECT "avatar", "bio", "createdAt", "eloRating", "email", "gender", "id", "isGuest", "language", "lastRatedAt", "likeCount", "location", "name", "normalCount", "notificationsEnabled", "passwordHash", "provider", "providerId", "timezone", "totalRatings", "totalScore", "updatedAt" FROM "users";
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
