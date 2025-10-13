-- AlterTable
ALTER TABLE "ratings" ADD COLUMN "raterEloAtTime" REAL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_photos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
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
INSERT INTO "new_photos" ("format", "id", "key", "size", "uploadedAt", "url", "userId") SELECT "format", "id", "key", "size", "uploadedAt", "url", "userId" FROM "photos";
DROP TABLE "photos";
ALTER TABLE "new_photos" RENAME TO "photos";
CREATE UNIQUE INDEX "photos_key_key" ON "photos"("key");
CREATE INDEX "photos_status_idx" ON "photos"("status");
CREATE INDEX "photos_userId_status_idx" ON "photos"("userId", "status");
CREATE INDEX "photos_userId_takenAt_idx" ON "photos"("userId", "takenAt");
CREATE TABLE "new_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "photoId" TEXT NOT NULL,
    "reporterId" TEXT,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reports_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_reports" ("createdAt", "id", "photoId", "reason", "reporterId") SELECT "createdAt", "id", "photoId", "reason", "reporterId" FROM "reports";
DROP TABLE "reports";
ALTER TABLE "new_reports" RENAME TO "reports";
CREATE INDEX "reports_photoId_idx" ON "reports"("photoId");
CREATE INDEX "reports_reporterId_idx" ON "reports"("reporterId");
CREATE INDEX "reports_status_idx" ON "reports"("status");
CREATE UNIQUE INDEX "reports_photoId_reporterId_key" ON "reports"("photoId", "reporterId");
CREATE TABLE "new_tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "emoji" TEXT,
    "color" TEXT,
    "category" TEXT,
    "normal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_tags" ("category", "color", "createdAt", "displayName", "emoji", "id", "name") SELECT "category", "color", "createdAt", "displayName", "emoji", "id", "name" FROM "tags";
DROP TABLE "tags";
ALTER TABLE "new_tags" RENAME TO "tags";
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");
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
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "eloRating" REAL NOT NULL DEFAULT 1500.0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "normalCount" INTEGER NOT NULL DEFAULT 0,
    "totalRatings" INTEGER NOT NULL DEFAULT 0,
    "lastRatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("avatar", "bio", "createdAt", "email", "gender", "id", "language", "location", "name", "notificationsEnabled", "passwordHash", "provider", "providerId", "timezone", "updatedAt") SELECT "avatar", "bio", "createdAt", "email", "gender", "id", "language", "location", "name", "notificationsEnabled", "passwordHash", "provider", "providerId", "timezone", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_eloRating_idx" ON "users"("eloRating");
CREATE INDEX "users_totalScore_idx" ON "users"("totalScore");
CREATE INDEX "users_gender_eloRating_idx" ON "users"("gender", "eloRating");
CREATE INDEX "users_isGuest_eloRating_idx" ON "users"("isGuest", "eloRating");
CREATE UNIQUE INDEX "users_provider_providerId_key" ON "users"("provider", "providerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ratings_raterId_type_idx" ON "ratings"("raterId", "type");

-- CreateIndex
CREATE INDEX "ratings_ratedUserId_createdAt_idx" ON "ratings"("ratedUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ratings_photoId_type_idx" ON "ratings"("photoId", "type");
