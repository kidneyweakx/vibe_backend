import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'bun:test'
import { PrismaClient } from '@prisma/client'
import { testUsers, cleanupTestData, setupTestData, startTestDb, stopTestDb } from '../setup'

// Ensure the code under test uses SQLite test DB
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db'

let UserService: any
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })

describe('UserService', () => {
  beforeAll(async () => {
    // Dynamic import after DATABASE_URL is set so getPrisma picks it up
    await startTestDb()
    UserService = (await import('../../src/routes/user/service')).UserService
  })

  afterAll(async () => {
    await stopTestDb()
  })

  beforeEach(async () => {
    await cleanupTestData()
    await setupTestData()
  })

  it('getUserById returns seeded user', async () => {
    const user = await UserService.getUserById(testUsers.user1.id)
    expect(user?.email).toBe(testUsers.user1.email)
  })

  it('upsertUser creates new user by provider/providerId', async () => {
    const created = await UserService.upsertUser({
      email: 'new@example.com',
      name: 'New User',
      provider: 'test',
      providerId: 'provider_new'
    })
    expect(created.id).toBeDefined()
    const found = await prisma.user.findUnique({ where: { provider_providerId: { provider: 'test', providerId: 'provider_new' } } })
    expect(found?.email).toBe('new@example.com')
  })

  it('upsertUser merges on unique email conflict', async () => {
    const existing = await prisma.user.create({ data: {
      id: 'email_conflict',
      email: 'dup@example.com',
      name: 'Dup',
      provider: 'test',
      providerId: 'dup',
    } })

    const res = await UserService.upsertUser({
      email: 'dup@example.com',
      name: 'Dup Updated',
      provider: 'test',
      providerId: 'dup_new'
    })

    expect(res.id).toBe(existing.id)
    expect(res.name).toBe('Dup Updated')
  })

  it('updateUser updates fields and updatedAt', async () => {
    const before = await prisma.user.findUnique({ where: { id: testUsers.user1.id } })
    const updated = await UserService.updateUser(testUsers.user1.id, { name: 'Changed', gender: 'other' })
    expect(updated.name).toBe('Changed')
    expect(updated.gender).toBe('other')
    const after = await prisma.user.findUnique({ where: { id: testUsers.user1.id } })
    expect(new Date(after!.updatedAt).getTime()).toBeGreaterThan(new Date(before!.updatedAt).getTime())
  })

  it('deleteUser removes user', async () => {
    await UserService.deleteUser(testUsers.user2.id)
    const gone = await prisma.user.findUnique({ where: { id: testUsers.user2.id } })
    expect(gone).toBeNull()
  })

  it('getUserPublicInfo returns stats and share info', async () => {
    const info = await UserService.getUserPublicInfo(testUsers.user1.id)
    expect(info.user.id).toBe(testUsers.user1.id)
    expect(info.stats).toHaveProperty('totalScore')
    expect(info.shareInfo).toHaveProperty('shareUrl')
  })

  it('generateShareableLink returns essential fields', async () => {
    const link = await UserService.generateShareableLink(testUsers.user1.id)
    expect(link.userId).toBe(testUsers.user1.id)
    expect(link.shareUrl).toContain(`/user/${testUsers.user1.id}`)
    expect(link.qrCodeUrl).toContain(`/user/qr/${testUsers.user1.id}`)
  })
})


