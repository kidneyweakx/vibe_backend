import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { PrismaClient } from '@prisma/client'
import { getAllTags } from '../../src/services/tag'
import { startTestDb, stopTestDb } from '../setup'

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL || 'file:./test.db' })

describe('services/tag with seeded data', () => {
  beforeAll(async () => { await startTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('getAllTags returns tags', async () => {
    const tags = await getAllTags(prisma)
    expect(Array.isArray(tags)).toBe(true)
  })
})


