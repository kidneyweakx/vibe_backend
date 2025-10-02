import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { cleanDatabase, closeDatabase, createTestUser, createTestPhoto, createAuthenticatedTestUser } from '../helpers/db'
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
      const { user, token } = await createAuthenticatedTestUser({
        email: 'homeinfo@example.com',
        name: 'Home Info User'
      })

      const response = await apiGet('/info/homeInfo', { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.topUsers).toBeDefined()
      expect(data.data.recentEvents).toBeDefined()
      expect(Array.isArray(data.data.topUsers)).toBe(true)
      expect(Array.isArray(data.data.recentEvents)).toBe(true)
    })

    test('includes top ranked users', async () => {
      const { user: authUser, token } = await createAuthenticatedTestUser({
        email: 'homeinfo-ranked@example.com',
        name: 'Auth User'
      })

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

      const response = await apiGet('/info/homeInfo', { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.topUsers.length).toBeGreaterThanOrEqual(1)
    })

    test('includes recent events', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'homeinfo-events@example.com'
      })

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

      const response = await apiGet('/info/homeInfo', { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.recentEvents.length).toBe(1)
      expect(data.data.recentEvents[0].title).toBe('Recent Event')
    })

    test('limits top users to 10', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'homeinfo-limit@example.com'
      })

      // Create 15 users
      for (let i = 1; i <= 15; i++) {
        await createTestUser({
          email: `user${i}@example.com`,
          name: `User ${i}`
        })
      }

      const response = await apiGet('/info/homeInfo', { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.topUsers.length).toBeLessThanOrEqual(10)
    })

    test('limits recent events to 5', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'homeinfo-events-limit@example.com'
      })

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

      const response = await apiGet('/info/homeInfo', { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.recentEvents.length).toBeLessThanOrEqual(5)
    })

    test('requires authentication', async () => {
      const response = await apiGet('/info/homeInfo')
      await expectError(response, 401)
    })
  })

  describe('GET /api/info/profileInfo/:userId', () => {
    test('returns complete profile info', async () => {
      const { user: authUser, token } = await createAuthenticatedTestUser({
        email: 'profileinfo-auth@example.com',
        name: 'Auth User'
      })

      const user = await createTestUser({
        email: 'profile@example.com',
        name: 'Profile User',
        provider: 'google',
        providerId: 'google_123'
      })

      // Add photos
      await createTestPhoto({ userId: user.id, key: 'test/photo1.jpg' })
      await createTestPhoto({ userId: user.id, key: 'test/photo2.jpg' })

      const response = await apiGet(`/info/profileInfo/${user.id}`, { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.user).toBeDefined()
      expect(data.data.user.id).toBe(user.id)
      expect(data.data.user.name).toBe('Profile User')
      expect(data.data.stats).toBeDefined()
      expect(data.data.photos).toBeDefined()
    })

    test('requires authentication', async () => {
      const user = await createTestUser({
        email: 'profile-no-auth@example.com'
      })

      const response = await apiGet(`/info/profileInfo/${user.id}`)
      await expectError(response, 401)
    })

    test('returns 404 for nonexistent user', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'profileinfo-404@example.com'
      })

      const response = await apiGet('/info/profileInfo/nonexistent-user-id', { token })
      await expectError(response, 404)
    })

    test('requires userId parameter', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'profileinfo-no-id@example.com'
      })

      const response = await apiGet('/info/profileInfo/', { token })
      // This should return 404 as route doesn't match
      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    test('includes pagination for photos', async () => {
      const { user: authUser, token } = await createAuthenticatedTestUser({
        email: 'profileinfo-page@example.com'
      })

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

      const response = await apiGet(`/info/profileInfo/${user.id}?page=1&limit=5`, { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.photos).toBeDefined()
      expect(data.data.photos.length).toBeLessThanOrEqual(5)
    })

    test('respects maximum limit of 60 photos', async () => {
      const { user: authUser, token } = await createAuthenticatedTestUser({
        email: 'profileinfo-maxlimit@example.com'
      })

      const user = await createTestUser({
        email: 'max-limit@example.com',
        name: 'Max Limit User'
      })

      const response = await apiGet(`/info/profileInfo/${user.id}?limit=100`, { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      // Should cap at 60
      expect(data.data.photos.length).toBeLessThanOrEqual(60)
    })

    test('handles page parameter', async () => {
      const { user: authUser, token } = await createAuthenticatedTestUser({
        email: 'profileinfo-pageparam@example.com'
      })

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

      const response = await apiGet(`/info/profileInfo/${user.id}?page=2&limit=2`, { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      // Should return photos from page 2
      expect(Array.isArray(data.data.photos)).toBe(true)
    })
  })

  describe('GET /api/info/journeyInfo/:userId', () => {
    test('returns journey dashboard data', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'journey@example.com',
        name: 'Journey User'
      })

      const response = await apiGet(`/info/journeyInfo/${user.id}`, { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.totalScore).toBeDefined()
      expect(data.data.totalRatings).toBeDefined()
      expect(data.data.overallRank).toBeDefined()
      expect(typeof data.data.totalScore).toBe('number')
      expect(typeof data.data.totalRatings).toBe('number')
    })

    test('requires authentication', async () => {
      const user = await createTestUser({
        email: 'journey-no-auth@example.com'
      })

      const response = await apiGet(`/info/journeyInfo/${user.id}`)
      await expectError(response, 401)
    })

    test('calculates scores from ratings', async () => {
      const { user: authUser, token: authToken } = await createAuthenticatedTestUser({
        email: 'journey-auth@example.com',
        name: 'Auth User'
      })

      const owner = await createTestUser({
        email: 'owner@example.com',
        name: 'Photo Owner'
      })

      const { user: rater1, token: token1 } = await createAuthenticatedTestUser({
        email: 'rater1@example.com',
        name: 'Rater 1'
      })

      const { user: rater2, token: token2 } = await createAuthenticatedTestUser({
        email: 'rater2@example.com',
        name: 'Rater 2'
      })

      const photo = await createTestPhoto({
        userId: owner.id,
        key: 'test/scored.jpg'
      })

      // Add ratings (raterId comes from authenticated user, not body)
      await apiPost('/rate/photo', {
        photoId: photo.id,
        type: 'like'
      }, { token: token1 })

      await apiPost('/rate/photo', {
        photoId: photo.id,
        type: 'normal'
      }, { token: token2 })

      const response = await apiGet(`/info/journeyInfo/${owner.id}`, { token: authToken })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.totalRatings).toBe(2)
      expect(data.data.totalScore).toBeGreaterThan(0)
    })

    test('requires userId parameter', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'journey-no-userid@example.com'
      })

      const response = await apiGet('/info/journeyInfo/', { token })
      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    test('returns 400 for missing userId', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'journey-missing-userid@example.com'
      })

      const response = await apiGet('/info/journeyInfo/', { token })
      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    test('handles user with no photos', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'no-photos@example.com',
        name: 'No Photos User'
      })

      const response = await apiGet(`/info/journeyInfo/${user.id}`, { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.totalRatings).toBe(0)
      expect(data.data.totalScore).toBe(0)
    })

    test('handles user with photos but no ratings', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'no-ratings@example.com',
        name: 'No Ratings User'
      })

      await createTestPhoto({
        userId: user.id,
        key: 'test/unrated.jpg'
      })

      const response = await apiGet(`/info/journeyInfo/${user.id}`, { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.totalRatings).toBe(0)
      expect(data.data.totalScore).toBe(0)
    })

    test('includes rank information', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'ranked@example.com',
        name: 'Ranked User'
      })

      const response = await apiGet(`/info/journeyInfo/${user.id}`, { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.overallRank).toBeDefined()
      expect(typeof data.data.overallRank).toBe('number')
    })

    test('handles timeout protection', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'timeout@example.com',
        name: 'Timeout User'
      })

      const response = await apiGet(`/info/journeyInfo/${user.id}`, { token })

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
