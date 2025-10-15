import type { PrismaClient } from '@prisma/client'
import getPrisma from '../../dbConfig'

let ensureCompleted = false
let ensureInFlight: Promise<void> | null = null

const USER_INDEXES: Array<{ name: string; sql: string }> = [
  {
    name: 'users_deviceId_key',
    sql: 'CREATE UNIQUE INDEX "users_deviceId_key" ON "users"("deviceId")'
  },
  {
    name: 'users_isGuest_isDeleted_eloRating_idx',
    sql: 'CREATE INDEX "users_isGuest_isDeleted_eloRating_idx" ON "users"("isGuest", "isDeleted", "eloRating" DESC)'
  },
  {
    name: 'users_isDeleted_lastRatedAt_idx',
    sql: 'CREATE INDEX "users_isDeleted_lastRatedAt_idx" ON "users"("isDeleted", "lastRatedAt" DESC)'
  },
  {
    name: 'users_createdAt_idx',
    sql: 'CREATE INDEX "users_createdAt_idx" ON "users"("createdAt" DESC)'
  }
]

const REQUIRED_COLUMNS: Array<{ name: string; definition: string }> = [
  { name: 'deviceId', definition: '"deviceId" TEXT' },
  { name: 'bio', definition: '"bio" TEXT' },
  { name: 'location', definition: '"location" TEXT' },
  { name: 'language', definition: '"language" TEXT' },
  { name: 'timezone', definition: '"timezone" TEXT' },
  { name: 'isGuest', definition: '"isGuest" BOOLEAN NOT NULL DEFAULT false' },
  { name: 'isDeleted', definition: '"isDeleted" BOOLEAN NOT NULL DEFAULT false' },
  { name: 'notificationsEnabled', definition: '"notificationsEnabled" BOOLEAN NOT NULL DEFAULT false' },
  { name: 'ageRange', definition: '"ageRange" TEXT' },
  { name: 'vibeLevel', definition: '"vibeLevel" INTEGER NOT NULL DEFAULT 0' },
  { name: 'timeInvestmentHours', definition: '"timeInvestmentHours" INTEGER NOT NULL DEFAULT 0' },
  { name: 'tosVersion', definition: '"tosVersion" TEXT' },
  { name: 'privacyVersion', definition: '"privacyVersion" TEXT' },
  { name: 'onboardedAt', definition: '"onboardedAt" DATETIME' },
  { name: 'eloRating', definition: '"eloRating" REAL NOT NULL DEFAULT 1500.0' },
  { name: 'totalScore', definition: '"totalScore" INTEGER NOT NULL DEFAULT 0' },
  { name: 'likeCount', definition: '"likeCount" INTEGER NOT NULL DEFAULT 0' },
  { name: 'normalCount', definition: '"normalCount" INTEGER NOT NULL DEFAULT 0' },
  { name: 'totalRatings', definition: '"totalRatings" INTEGER NOT NULL DEFAULT 0' },
  { name: 'lastRatedAt', definition: '"lastRatedAt" DATETIME' },
  { name: 'deletedAt', definition: '"deletedAt" DATETIME' }
]

export const ensureUserSchema = async (client?: PrismaClient) => {
  if (ensureCompleted) return
  if (ensureInFlight) {
    return ensureInFlight
  }

  const prisma = client ?? getPrisma()

  ensureInFlight = (async () => {
    const columns: Array<{ name: string }> = await prisma.$queryRawUnsafe(
      'PRAGMA table_info("users")'
    )

    const columnNames = new Set(columns.map((column) => column.name))

    for (const { name, definition } of REQUIRED_COLUMNS) {
      if (!columnNames.has(name)) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN ${definition}`)
      }
    }

    const indexes: Array<{ name: string }> = await prisma.$queryRawUnsafe(
      'PRAGMA index_list("users")'
    )
    const indexNames = new Set(indexes.map((index) => index.name))

    for (const { name, sql } of USER_INDEXES) {
      if (!indexNames.has(name)) {
        await prisma.$executeRawUnsafe(sql)
      }
    }
  })()

  try {
    await ensureInFlight
    ensureCompleted = true
  } finally {
    ensureInFlight = null
  }
}

export default ensureUserSchema
