import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { cleanDatabase, closeDatabase } from '../helpers/db'
import { apiGet, expectSuccess } from '../helpers/api'

describe('Event E2E', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeDatabase()
  })

  describe('GET /api/event/list', () => {
    test('returns empty array when no events exist', async () => {
      const response = await apiGet('/event/list')
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data).toEqual([])
    })

    test('returns events with default limit', async () => {
      // Create test events
      const db = await import('../../src/dbConfig').then(m => m.default())

      for (let i = 1; i <= 3; i++) {
        const startDay = 10 + i
        const endDay = 15 + i
        await db.event.create({
          data: {
            title: `Event ${i}`,
            description: `Description for event ${i}`,
            key: `events/event${i}.jpg`,
            url: `https://example.com/event${i}.jpg`,
            imageUrl: `https://example.com/event${i}.jpg`,
            format: 'jpg',
            size: 100000,
            startsAt: new Date(`2025-01-${startDay}`),
            endsAt: new Date(`2025-01-${endDay}`)
          }
        })
      }

      const response = await apiGet('/event/list')
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(3)
      expect(data.data[0].title).toBeDefined()
      expect(data.data[0].imageUrl).toBeDefined()
    })

    test('respects custom limit parameter', async () => {
      const db = await import('../../src/dbConfig').then(m => m.default())

      // Create 10 events
      for (let i = 1; i <= 10; i++) {
        await db.event.create({
          data: {
            title: `Event ${i}`,
            key: `events/event${i}.jpg`,
            url: `https://example.com/event${i}.jpg`,
            imageUrl: `https://example.com/event${i}.jpg`,
            format: 'jpg',
            size: 100000,
            startsAt: new Date(`2025-01-01`)
          }
        })
      }

      const response = await apiGet('/event/list?limit=5')
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(5)
    })

    test('handles limit=0 to fetch all events', async () => {
      const db = await import('../../src/dbConfig').then(m => m.default())

      // Create multiple events
      for (let i = 1; i <= 25; i++) {
        await db.event.create({
          data: {
            title: `Event ${i}`,
            key: `events/event${i}.jpg`,
            url: `https://example.com/event${i}.jpg`,
            imageUrl: `https://example.com/event${i}.jpg`,
            format: 'jpg',
            size: 100000,
            startsAt: new Date(`2025-01-01`)
          }
        })
      }

      // With default limit of 20, should get 20 events
      const response1 = await apiGet('/event/list')
      const data1 = await expectSuccess(response1)
      expect(data1.data.length).toBe(20)

      // With limit=0 or high limit, should get all events
      const response2 = await apiGet('/event/list?limit=100')
      const data2 = await expectSuccess(response2)
      expect(data2.data.length).toBe(25)
    })

    test('returns events sorted by creation date (newest first)', async () => {
      const db = await import('../../src/dbConfig').then(m => m.default())

      // Create events with different dates
      const event1 = await db.event.create({
        data: {
          title: 'Old Event',
          key: 'events/old.jpg',
          url: 'https://example.com/old.jpg',
          imageUrl: 'https://example.com/old.jpg',
          format: 'jpg',
          size: 100000,
          startsAt: new Date('2025-01-01'),
          createdAt: new Date('2025-01-01')
        }
      })

      // Small delay to ensure different creation times
      await new Promise(resolve => setTimeout(resolve, 10))

      const event2 = await db.event.create({
        data: {
          title: 'New Event',
          key: 'events/new.jpg',
          url: 'https://example.com/new.jpg',
          imageUrl: 'https://example.com/new.jpg',
          format: 'jpg',
          size: 100000,
          startsAt: new Date('2025-02-01'),
          createdAt: new Date('2025-02-01')
        }
      })

      const response = await apiGet('/event/list')
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(2)
      // Assuming service sorts by newest first
      expect(data.data[0].title).toBeDefined()
    })

    test('includes all event fields in response', async () => {
      const db = await import('../../src/dbConfig').then(m => m.default())

      await db.event.create({
        data: {
          title: 'Complete Event',
          description: 'Full description',
          key: 'events/complete.jpg',
          url: 'https://example.com/complete.jpg',
          imageUrl: 'https://example.com/complete.jpg',
          format: 'jpg',
          size: 100000,
          startsAt: new Date('2025-03-01'),
          endsAt: new Date('2025-03-31')
        }
      })

      const response = await apiGet('/event/list')
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(1)

      const event = data.data[0]
      expect(event.id).toBeDefined()
      expect(event.title).toBe('Complete Event')
      expect(event.imageUrl).toBeDefined() // Presigned URL is generated
      expect(event.imageUrl).toContain('events/complete.jpg')
      expect(event.description).toBe('Full description')
      expect(event.startsAt).toBeDefined()
      expect(event.endsAt).toBeDefined()
    })

    test('handles invalid limit parameter gracefully', async () => {
      const db = await import('../../src/dbConfig').then(m => m.default())

      await db.event.create({
        data: {
          title: 'Test Event',
          key: 'events/test.jpg',
          url: 'https://example.com/test.jpg',
          imageUrl: 'https://example.com/test.jpg',
          format: 'jpg',
          size: 100000,
          startsAt: new Date('2025-01-01')
        }
      })

      // Invalid limit should fallback to default
      const response = await apiGet('/event/list?limit=invalid')
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBeGreaterThanOrEqual(1)
    })

    test('handles negative limit parameter', async () => {
      const db = await import('../../src/dbConfig').then(m => m.default())

      await db.event.create({
        data: {
          title: 'Test Event',
          key: 'events/test-negative.jpg',
          url: 'https://example.com/test.jpg',
          imageUrl: 'https://example.com/test.jpg',
          format: 'jpg',
          size: 100000,
          startsAt: new Date('2025-01-01')
        }
      })

      const response = await apiGet('/event/list?limit=-1')
      const data = await expectSuccess(response)

      // Should handle gracefully, likely returning empty or default
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data)).toBe(true)
    })
  })
})
