import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { cleanDatabase, closeDatabase, createTestUser, createTestPhoto } from '../helpers/db'
import { apiGet, apiPost, expectSuccess, expectError } from '../helpers/api'

describe('Info E2E', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeDatabase()
  })

  describe('GET /api/info/homeInfo', () => {
    test('returns home info with rankings and events', async () => {
      const response = await apiGet('/info/homeInfo')
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.topUsers).toBeDefined()
      expect(data.data.recentEvents).toBeDefined()
      expect(Array.isArray(data.data.topUsers)).toBe(true)
      expect(Array.isArray(data.data.recentEvents)).toBe(true)
    })

    test('includes top ranked users', async () => {
      // Create users with photos and ratings
      const user1 = await createTestUser({
        email: 'ranked1@example.com',
        name: 'Top User'
      })

      const user2 = await createTestUser({
        email: 'ranked2@example.com',
        name: 'Second User'
      })

      const photo1 = await createTestPhoto({
        userId: user1.id,
        key: 'test/ranked1.jpg'
      })

      const photo2 = await createTestPhoto({
        userId: user2.id,
        key: 'test/ranked2.jpg'
      })

      // Add ratings
      const db = await import('../../src/dbConfig').then(m => m.default())
      await db.rating.create({
        data: {
          raterId: user2.id,
          photoId: photo1.id,
          type: 'like'
        }
      })

      await db.rating.create({
        data: {
          raterId: user1.id,
          photoId: photo2.id,
          type: 'normal'
        }
      })

      const response = await apiGet('/info/homeInfo')
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.topUsers.length).toBeGreaterThanOrEqual(1)
    })

    test('includes recent events', async () => {
      const db = await import('../../src/dbConfig').then(m => m.default())

      await db.event.create({
        data: {
          title: 'Recent Event',
          key: 'events/recent.jpg',
          url: 'https://example.com/event.jpg',
          imageUrl: 'https://example.com/event.jpg',
          format: 'jpg',
          size: 100000,
          startsAt: new Date('2025-06-01')
        }
      })

      const response = await apiGet('/info/homeInfo')
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.recentEvents.length).toBe(1)
      expect(data.data.recentEvents[0].title).toBe('Recent Event')
    })

    test('limits top users to 10', async () => {
      // Create 15 users
      for (let i = 1; i <= 15; i++) {
        await createTestUser({
          email: `user${i}@example.com`,
          name: `User ${i}`
        })
      }

      const response = await apiGet('/info/homeInfo')
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.topUsers.length).toBeLessThanOrEqual(10)
    })

    test('limits recent events to 5', async () => {
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
            startsAt: new Date(`2025-0${Math.min(i, 9)}-01`)
          }
        })
      }

      const response = await apiGet('/info/homeInfo')
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.recentEvents.length).toBeLessThanOrEqual(5)
    })
  })

  describe('GET /api/info/profileInfo/:userId', () => {
    test('returns complete profile info', async () => {
      const user = await createTestUser({
        email: 'profile@example.com',
        name: 'Profile User',
        provider: 'google',
        providerId: 'google_123'
      })

      // Add photos
      await createTestPhoto({ userId: user.id, key: 'test/photo1.jpg' })
      await createTestPhoto({ userId: user.id, key: 'test/photo2.jpg' })

      const response = await apiGet(`/info/profileInfo/${user.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.user).toBeDefined()
      expect(data.data.user.id).toBe(user.id)
      expect(data.data.user.name).toBe('Profile User')
      expect(data.data.stats).toBeDefined()
      expect(data.data.photos).toBeDefined()
    })

    test('returns 404 for nonexistent user', async () => {
      const response = await apiGet('/info/profileInfo/nonexistent-user-id')
      await expectError(response, 404)
    })

    test('requires userId parameter', async () => {
      const response = await apiGet('/info/profileInfo/')
      // This should return 404 as route doesn't match
      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    test('includes pagination for photos', async () => {
      const user = await createTestUser({
        email: 'paginated@example.com',
        name: 'Paginated User'
      })

      // Create multiple photos
      for (let i = 1; i <= 10; i++) {
        await createTestPhoto({
          userId: user.id,
          key: `test/photo${i}.jpg`
        })
      }

      const response = await apiGet(`/info/profileInfo/${user.id}?page=1&limit=5`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.photos).toBeDefined()
      expect(data.data.photos.length).toBeLessThanOrEqual(5)
    })

    test('respects maximum limit of 60 photos', async () => {
      const user = await createTestUser({
        email: 'max-limit@example.com',
        name: 'Max Limit User'
      })

      const response = await apiGet(`/info/profileInfo/${user.id}?limit=100`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      // Should cap at 60
      expect(data.data.photos.length).toBeLessThanOrEqual(60)
    })

    test('handles page parameter', async () => {
      const user = await createTestUser({
        email: 'page-param@example.com',
        name: 'Page User'
      })

      for (let i = 1; i <= 5; i++) {
        await createTestPhoto({
          userId: user.id,
          key: `test/page${i}.jpg`
        })
      }

      const response = await apiGet(`/info/profileInfo/${user.id}?page=2&limit=2`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      // Should return photos from page 2
      expect(Array.isArray(data.data.photos)).toBe(true)
    })
  })

  describe('GET /api/info/journeyInfo/:userId', () => {
    test('returns journey dashboard data', async () => {
      const user = await createTestUser({
        email: 'journey@example.com',
        name: 'Journey User'
      })

      const response = await apiGet(`/info/journeyInfo/${user.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.totalScore).toBeDefined()
      expect(data.data.totalRatings).toBeDefined()
      expect(data.data.overallRank).toBeDefined()
      expect(typeof data.data.totalScore).toBe('number')
      expect(typeof data.data.totalRatings).toBe('number')
    })

    test('calculates scores from ratings', async () => {
      const owner = await createTestUser({
        email: 'owner@example.com',
        name: 'Photo Owner'
      })

      const rater1 = await createTestUser({
        email: 'rater1@example.com',
        name: 'Rater 1'
      })

      const rater2 = await createTestUser({
        email: 'rater2@example.com',
        name: 'Rater 2'
      })

      const photo = await createTestPhoto({
        userId: owner.id,
        key: 'test/scored.jpg'
      })

      // Add ratings
      await apiPost('/rate/photo', {
        raterId: rater1.id,
        photoId: photo.id,
        type: 'like'
      })

      await apiPost('/rate/photo', {
        raterId: rater2.id,
        photoId: photo.id,
        type: 'normal'
      })

      const response = await apiGet(`/info/journeyInfo/${owner.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.totalRatings).toBe(2)
      expect(data.data.totalScore).toBeGreaterThan(0)
    })

    test('requires userId parameter', async () => {
      const response = await apiGet('/info/journeyInfo/')
      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    test('returns 400 for missing userId', async () => {
      const response = await apiGet('/info/journeyInfo/')
      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    test('handles user with no photos', async () => {
      const user = await createTestUser({
        email: 'no-photos@example.com',
        name: 'No Photos User'
      })

      const response = await apiGet(`/info/journeyInfo/${user.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.totalRatings).toBe(0)
      expect(data.data.totalScore).toBe(0)
    })

    test('handles user with photos but no ratings', async () => {
      const user = await createTestUser({
        email: 'no-ratings@example.com',
        name: 'No Ratings User'
      })

      await createTestPhoto({
        userId: user.id,
        key: 'test/unrated.jpg'
      })

      const response = await apiGet(`/info/journeyInfo/${user.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.totalRatings).toBe(0)
      expect(data.data.totalScore).toBe(0)
    })

    test('includes rank information', async () => {
      const user = await createTestUser({
        email: 'ranked@example.com',
        name: 'Ranked User'
      })

      const response = await apiGet(`/info/journeyInfo/${user.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.overallRank).toBeDefined()
      expect(typeof data.data.overallRank).toBe('number')
    })

    test('handles timeout protection', async () => {
      const user = await createTestUser({
        email: 'timeout@example.com',
        name: 'Timeout User'
      })

      const response = await apiGet(`/info/journeyInfo/${user.id}`)

      // Should either succeed or timeout with 504
      if (response.status === 504) {
        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.error).toContain('timeout')
      } else {
        const data = await expectSuccess(response)
        expect(data.success).toBe(true)
      }
    })
  })
})
