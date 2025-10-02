import { PrismaClient } from '@prisma/client'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { getPrisma } from '../../src/dbConfig'

// Real test database - no mocking
const TEST_DB_PATH = resolve(process.cwd(), 'prisma', 'test.db')

export async function getTestDb(): Promise<PrismaClient> {
  // Use the same Prisma instance as the application
  // This ensures tests and services use the same connection
  const db = getPrisma()

  // Verify database is accessible
  try {
    await db.$queryRaw`SELECT 1 FROM users LIMIT 1`
  } catch (error) {
    console.warn('Test database schema not initialized. Run: DATABASE_URL=file:test.db bunx prisma db push')
  }

  return db
}

export async function cleanDatabase(): Promise<void> {
  const db = await getTestDb()

  // Delete in order to respect foreign key constraints
  await db.onboarding.deleteMany()
  await db.report.deleteMany()
  await db.photoTag.deleteMany()
  await db.rating.deleteMany()
  await db.photo.deleteMany()
  await db.tag.deleteMany()
  await db.event.deleteMany()
  await db.user.deleteMany()
}

export async function closeDatabase(): Promise<void> {
  const db = getPrisma()
  if (db) {
    await db.$disconnect()
  }
}

export async function resetDatabase(): Promise<void> {
  await cleanDatabase()
}

// Seed helpers for common test data
export async function createTestUser(data: {
  email: string
  name?: string
  provider?: string
  providerId?: string
  gender?: string | null
}) {
  const db = await getTestDb()
  return db.user.create({
    data: {
      email: data.email,
      name: data.name || 'Test User',
      provider: data.provider || 'test',
      providerId: data.providerId || data.email,
      ...(data.gender !== undefined && { gender: data.gender })
    }
  })
}

export async function createTestPhoto(data: {
  userId: string
  key: string
  isProfilePicture?: boolean
}) {
  const db = await getTestDb()
  return db.photo.create({
    data: {
      userId: data.userId,
      key: data.key,
      url: `https://example.com/${data.key}`,
      format: 'jpg',
      size: 100000,
      isProfilePicture: data.isProfilePicture ?? false
    }
  })
}

export async function createTestTag(data: {
  name: string
  displayName: string
}) {
  const db = await getTestDb()
  return db.tag.create({
    data: {
      name: data.name,
      displayName: data.displayName,
      emoji: '🏷️',
      color: '#000000',
      category: 'test'
    }
  })
}

/**
 * Create a test user and return with JWT token for authenticated API calls
 */
export async function createAuthenticatedTestUser(data?: {
  email?: string
  name?: string
  provider?: string
}) {
  const { generateTestToken } = await import('./api')

  const user = await createTestUser({
    email: data?.email || `test-${Date.now()}@example.com`,
    name: data?.name || 'Test User',
    provider: data?.provider || 'test',
    providerId: data?.email || `test-${Date.now()}`
  })

  const token = await generateTestToken(user.id)

  return { user, token }
}
