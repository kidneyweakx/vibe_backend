#!/usr/bin/env bun

import { promises as fsp } from 'fs'
import { readdirSync, statSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

// Use test.db by default (same as test runner)
const datasourceUrl = process.env.DATABASE_URL || 'file:./test.db'
const prisma = new PrismaClient({ datasourceUrl })

const ROOT = path.resolve(__dirname, '..')
const FAKE_DATA_DIR = path.join(ROOT, 'fake-data')
const EVENT_DIR = path.join(FAKE_DATA_DIR, 'event')
const EVENT_URLS_TXT = path.join(EVENT_DIR, 'urls.txt')
const EVENT_URLS_JSON = path.join(EVENT_DIR, 'urls.json')

type SeedOptions = {
  clearBefore?: boolean
  users?: number
  photosPerUser?: number
  seedEvents?: boolean
}

function existsFile(p: string): boolean {
  try { return !!statSync(p, { throwIfNoEntry: false }) } catch { return false }
}

async function seedUsersAndPhotos(count: number, photosPerUser: number): Promise<void> {
  const users: Array<{ id: string; email: string; name: string; provider: string; providerId: string }> = []
  for (let i = 0; i < count; i++) {
    const id = `fake_user_${i + 1}`
    users.push({
      id,
      email: `${id}@fake.local`,
      name: `Fake User ${i + 1}`,
      provider: 'test',
      providerId: id
    })
  }
  await prisma.user.createMany({ data: users })

  const photos: Array<{ id: string; userId: string; key: string; url: string; format: string; size: number; uploadedAt: Date }> = []
  const now = Date.now()
  for (let u = 0; u < users.length; u++) {
    for (let p = 0; p < photosPerUser; p++) {
      const id = `fake_photo_${u + 1}_${p + 1}`
      const uploadedAt = new Date(now - (u * photosPerUser + p + 1) * 1000)
      photos.push({
        id,
        userId: users[u].id,
        key: `fake/${users[u].id}/${p + 1}.jpg`,
        url: `https://example.com/fake/${users[u].id}/${p + 1}.jpg`,
        format: 'jpg',
        size: 1024 + p * 10,
        uploadedAt
      })
    }
  }
  if (photos.length) await prisma.photo.createMany({ data: photos })
}

async function seedEvents(): Promise<void> {
  const titlesFallback = [
    'Sneaker Meetup', 'Street Art Pop-up', 'Indie Night', 'Rooftop Party', 'Dance Contest',
    'Runway Preview', 'Makeup Workshop', 'Festival Warmup', 'Glow Session', 'K-Culture Day'
  ]

  let urlsArray: string[] = []
  try {
    if (existsFile(EVENT_URLS_JSON)) {
      const raw = await fsp.readFile(EVENT_URLS_JSON, 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) urlsArray = parsed.filter((s) => typeof s === 'string' && s.length > 0)
    } else if (existsFile(EVENT_URLS_TXT)) {
      const raw = await fsp.readFile(EVENT_URLS_TXT, 'utf-8')
      urlsArray = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    }
  } catch {}

  // Also look for image files to derive count
  let imageFiles: string[] = []
  try {
    imageFiles = readdirSync(EVENT_DIR).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
  } catch {}

  const count = Math.max(urlsArray.length, imageFiles.length, 5)
  const now = Date.now()
  const events: Array<any> = []
  for (let i = 0; i < count; i++) {
    const title = titlesFallback[i % titlesFallback.length]
    const start = new Date(now + (i + 1) * 24 * 60 * 60 * 1000)
    const end = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000)
    const url = urlsArray[i] || `https://example.com/event/${i + 1}`
    events.push({
      id: `fake_event_${i + 1}`,
      title,
      description: `${title} — test seeded event`,
      key: `events/fake_${i + 1}.webp`,
      url,
      imageUrl: url,
      format: 'webp',
      size: 0,
      startsAt: start,
      endsAt: end
    })
  }
  await (prisma as any).event.createMany?.({ data: events })
}

async function clearAll(): Promise<void> {
  await prisma.rating.deleteMany({})
  await prisma.photoTag.deleteMany({})
  await prisma.photo.deleteMany({})
  await prisma.tag.deleteMany({})
  await prisma.user.deleteMany({})
  await (prisma as any).event?.deleteMany?.({})
}

export async function seedFakeData(options: SeedOptions = {}): Promise<void> {
  const { clearBefore = true, users = 5, photosPerUser = 2, seedEvents: withEvents = true } = options
  if (clearBefore) await clearAll()

  await seedUsersAndPhotos(users, photosPerUser)

  // A couple of default tags
  await prisma.tag.createMany({
    data: [
      { id: 'seed_tag_1', name: 'street', displayName: '街頭', emoji: '🛹', color: '#E67E22', category: 'style' },
      { id: 'seed_tag_2', name: 'sporty', displayName: '運動風', emoji: '🏃', color: '#27AE60', category: 'style' }
    ]
  })

  if (withEvents) await seedEvents()
}

// Allow running as a script: `bun run tests/seedFakeData.ts`
async function main() {
  try {
    console.log('🌱 Seeding fake data into', datasourceUrl)
    await seedFakeData()
    console.log('✅ Seeding complete')
  } catch (e) {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (import.meta.main) {
  main()
}


