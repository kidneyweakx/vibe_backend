/*
  Warnings:

  - You are about to drop the column `score` on the `ratings` table. All the data in the column will be lost.
  - Added the required column `type` to the `ratings` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ratings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "raterId" TEXT NOT NULL,
    "ratedUserId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ratings_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ratings_ratedUserId_fkey" FOREIGN KEY ("ratedUserId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ratings_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ratings" ("createdAt", "id", "photoId", "ratedUserId", "raterId") SELECT "createdAt", "id", "photoId", "ratedUserId", "raterId" FROM "ratings";
DROP TABLE "ratings";
ALTER TABLE "new_ratings" RENAME TO "ratings";
CREATE UNIQUE INDEX "ratings_raterId_photoId_key" ON "ratings"("raterId", "photoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
