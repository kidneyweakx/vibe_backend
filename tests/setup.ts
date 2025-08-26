import { PrismaClient, Prisma } from '@prisma/client'

// Dedicated Prisma client for tests that respects DATABASE_URL (file:./test.db)
const datasourceUrl = process.env.DATABASE_URL || 'file:./test.db'
export const testPrisma = new PrismaClient({ datasourceUrl })

// Reusable seed data used by existing service tests
export const testUsers = {
  user1: {
    id: 'user_1',
    email: 'user1@example.com',
    name: 'User One',
    provider: 'test',
    providerId: 'user_1'
  },
  user2: {
    id: 'user_2',
    email: 'user2@example.com',
    name: 'User Two',
    provider: 'test',
    providerId: 'user_2'
  }
}

export const testTags = [
  { id: 'tag_1', name: 'sporty', displayName: '運動風', emoji: '🏃', color: '#27AE60', category: 'style' },
  { id: 'tag_2', name: 'street', displayName: '街頭', emoji: '🛹', color: '#E67E22', category: 'style' },
  { id: 'tag_3', name: 'elegant', displayName: '優雅', emoji: '👗', color: '#9B59B6', category: 'style' }
]

export let testPhotos: Array<Prisma.PhotoCreateManyInput> = []

export async function cleanupTestData(): Promise<void> {
  // Order matters due to FKs
  await testPrisma.rating.deleteMany({})
  await testPrisma.photoTag.deleteMany({})
  await testPrisma.photo.deleteMany({})
  await testPrisma.tag.deleteMany({})
  await testPrisma.user.deleteMany({})
  await (testPrisma as any).event?.deleteMany?.({})
}

export async function setupTestData(): Promise<void> {
  // Users
  await testPrisma.user.createMany({ data: [testUsers.user1, testUsers.user2] })

  // Tags
  await testPrisma.tag.createMany({ data: testTags })

  // Photos
  const now = Date.now()
  testPhotos = [
    {
      id: 'photo_1',
      userId: testUsers.user1.id,
      key: 'test/user1/1.jpg',
      url: 'https://example.com/test/user1/1.jpg',
      format: 'jpg',
      size: 12345,
      uploadedAt: new Date(now - 2000)
    },
    {
      id: 'photo_2',
      userId: testUsers.user1.id,
      key: 'test/user1/2.jpg',
      url: 'https://example.com/test/user1/2.jpg',
      format: 'jpg',
      size: 23456,
      uploadedAt: new Date(now - 1000)
    },
    {
      id: 'photo_3',
      userId: testUsers.user2.id,
      key: 'test/user2/1.jpg',
      url: 'https://example.com/test/user2/1.jpg',
      format: 'jpg',
      size: 34567,
      uploadedAt: new Date(now - 3000)
    }
  ]

  await testPrisma.photo.createMany({ data: testPhotos })
}


