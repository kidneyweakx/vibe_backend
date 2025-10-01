import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { cleanDatabase, closeDatabase, createTestUser, createTestPhoto } from '../helpers/db'
import { apiGet, apiPost, expectSuccess, expectError } from '../helpers/api'

describe('Photo Rating E2E', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeDatabase()
  })

  describe('Complete photo rating flow', () => {
    test('user can rate photos and view results', async () => {
      // Create users
      const rater = await createTestUser({
        email: 'rater@example.com',
        name: 'Rater'
      })

      const owner1 = await createTestUser({
        email: 'owner1@example.com',
        name: 'Owner 1'
      })

      const owner2 = await createTestUser({
        email: 'owner2@example.com',
        name: 'Owner 2'
      })

      // Create photos
      const photo1 = await createTestPhoto({
        userId: owner1.id,
        key: 'test/photo1.jpg'
      })

      const photo2 = await createTestPhoto({
        userId: owner2.id,
        key: 'test/photo2.jpg'
      })

      // Rate photos
      const rate1 = await apiPost('/rate/photo', {
        raterId: rater.id,
        photoId: photo1.id,
        type: 'like'
      })

      const rate1Data = await expectSuccess(rate1)
      expect(rate1Data.success).toBe(true)

      const rate2 = await apiPost('/rate/photo', {
        raterId: rater.id,
        photoId: photo2.id,
        type: 'normal'
      })

      const rate2Data = await expectSuccess(rate2)
      expect(rate2Data.success).toBe(true)

      // Try to rate same photo again (should fail)
      const duplicateRate = await apiPost('/rate/photo', {
        raterId: rater.id,
        photoId: photo1.id,
        type: 'normal'
      })

      const duplicateData = await duplicateRate.json()
      expect(duplicateData.success).toBe(false)
      expect(duplicateData.error).toContain('already rated')
    })

    test('prevents self-rating', async () => {
      const user = await createTestUser({
        email: 'self-rate@example.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/self.jpg'
      })

      const response = await apiPost('/rate/photo', {
        raterId: user.id,
        photoId: photo.id,
        type: 'like'
      })

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('own photo')
    })
  })

  describe('GET /api/rate/photos/random', () => {
    test('returns random photos for rating', async () => {
      const rater = await createTestUser({
        email: 'random-rater@example.com'
      })

      const owner = await createTestUser({
        email: 'photo-owner@example.com'
      })

      // Create some photos
      await createTestPhoto({ userId: owner.id, key: 'test/1.jpg' })
      await createTestPhoto({ userId: owner.id, key: 'test/2.jpg' })
      await createTestPhoto({ userId: owner.id, key: 'test/3.jpg' })

      const response = await apiGet(`/rate/photos/random?userId=${rater.id}&limit=2`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBeLessThanOrEqual(2)

      // Photos should not belong to rater
      for (const photo of data.data) {
        expect(photo.userId).not.toBe(rater.id)
      }
    })

    test('excludes already-rated photos', async () => {
      const rater = await createTestUser({
        email: 'exclude-rater@example.com'
      })

      const owner = await createTestUser({
        email: 'exclude-owner@example.com'
      })

      const photo1 = await createTestPhoto({
        userId: owner.id,
        key: 'test/rated.jpg'
      })

      const photo2 = await createTestPhoto({
        userId: owner.id,
        key: 'test/unrated.jpg'
      })

      // Rate photo1
      await apiPost('/rate/photo', {
        raterId: rater.id,
        photoId: photo1.id,
        type: 'like'
      })

      // Get random photos
      const response = await apiGet(`/rate/photos/random?userId=${rater.id}&limit=10`)
      const data = await expectSuccess(response)

      const photoIds = data.data.map((p: any) => p.id)

      // Should not include already-rated photo1
      expect(photoIds).not.toContain(photo1.id)

      // Should include unrated photo2
      expect(photoIds).toContain(photo2.id)
    })

    test('requires userId parameter', async () => {
      const response = await apiGet('/rate/photos/random')
      await expectError(response, 400)
    })

    test('uses default limit when not specified', async () => {
      const rater = await createTestUser({
        email: 'default-limit@example.com'
      })

      const owner = await createTestUser({
        email: 'default-owner@example.com'
      })

      // Create 15 photos
      for (let i = 1; i <= 15; i++) {
        await createTestPhoto({ userId: owner.id, key: `test/default${i}.jpg` })
      }

      const response = await apiGet(`/rate/photos/random?userId=${rater.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      // Default limit is 10
      expect(data.data.length).toBeLessThanOrEqual(10)
    })

    test('returns empty array when no photos available', async () => {
      const rater = await createTestUser({
        email: 'empty-rater@example.com'
      })

      const response = await apiGet(`/rate/photos/random?userId=${rater.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(0)
    })

    test('excludes photos from guest users', async () => {
      const rater = await createTestUser({
        email: 'guest-test@example.com'
      })

      // Create guest user
      const db = await import('../../src/dbConfig').then(m => m.default())
      const guestUser = await db.user.create({
        data: {
          email: 'guest@example.com',
          name: 'Guest User',
          provider: 'guest',
          providerId: 'guest_123',
          isGuest: true
        }
      })

      const normalUser = await createTestUser({
        email: 'normal@example.com'
      })

      // Create photos
      await createTestPhoto({ userId: guestUser.id, key: 'test/guest.jpg' })
      await createTestPhoto({ userId: normalUser.id, key: 'test/normal.jpg' })

      const response = await apiGet(`/rate/photos/random?userId=${rater.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      // Should not include guest user photos
      const userIds = data.data.map((p: any) => p.userId)
      expect(userIds).not.toContain(guestUser.id)
    })

    test('excludes profile pictures', async () => {
      const rater = await createTestUser({
        email: 'profile-test@example.com'
      })

      const owner = await createTestUser({
        email: 'owner-profile@example.com'
      })

      // Create profile picture and regular photo
      const db = await import('../../src/dbConfig').then(m => m.default())
      await db.photo.create({
        data: {
          userId: owner.id,
          key: 'profile-pictures/profile.jpg',
          url: 'https://example.com/profile.jpg',
          format: 'jpg',
          size: 100000,
          isProfilePicture: true
        }
      })

      await createTestPhoto({ userId: owner.id, key: 'test/regular.jpg' })

      const response = await apiGet(`/rate/photos/random?userId=${rater.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      // Should not include profile pictures
      for (const photo of data.data) {
        expect(photo.key).not.toContain('profile-pictures/')
      }
    })

    test('returns one photo per user', async () => {
      const rater = await createTestUser({
        email: 'distinct-test@example.com'
      })

      const owner1 = await createTestUser({
        email: 'owner-a@example.com'
      })

      const owner2 = await createTestUser({
        email: 'owner-b@example.com'
      })

      // Create multiple photos per user
      await createTestPhoto({ userId: owner1.id, key: 'test/a1.jpg' })
      await createTestPhoto({ userId: owner1.id, key: 'test/a2.jpg' })
      await createTestPhoto({ userId: owner2.id, key: 'test/b1.jpg' })
      await createTestPhoto({ userId: owner2.id, key: 'test/b2.jpg' })

      const response = await apiGet(`/rate/photos/random?userId=${rater.id}&limit=10`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)

      // Check that userIds are unique
      const userIds = data.data.map((p: any) => p.userId)
      const uniqueUserIds = [...new Set(userIds)]
      expect(userIds.length).toBe(uniqueUserIds.length)
    })

    test('handles timeout gracefully', async () => {
      const rater = await createTestUser({
        email: 'timeout-test@example.com'
      })

      const response = await apiGet(`/rate/photos/random?userId=${rater.id}`)

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

    test('excludes photos with 2 or more reports', async () => {
      const rater = await createTestUser({
        email: 'reported-test@example.com'
      })

      const owner = await createTestUser({
        email: 'reported-owner@example.com'
      })

      const reporter1 = await createTestUser({
        email: 'reporter1@example.com'
      })

      const reporter2 = await createTestUser({
        email: 'reporter2@example.com'
      })

      const reportedPhoto = await createTestPhoto({
        userId: owner.id,
        key: 'test/reported.jpg'
      })

      const cleanPhoto = await createTestPhoto({
        userId: owner.id,
        key: 'test/clean.jpg'
      })

      // Add 2 reports to first photo
      await apiPost('/file/report', {
        photoId: reportedPhoto.id,
        reporterId: reporter1.id,
        reason: 'inappropriate'
      })

      await apiPost('/file/report', {
        photoId: reportedPhoto.id,
        reporterId: reporter2.id,
        reason: 'spam'
      })

      const response = await apiGet(`/rate/photos/random?userId=${rater.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      const photoIds = data.data.map((p: any) => p.id)
      // Should not include reported photo
      expect(photoIds).not.toContain(reportedPhoto.id)
      // Should include clean photo
      expect(photoIds).toContain(cleanPhoto.id)
    })
  })

  describe('GET /api/info/journeyInfo/:userId', () => {
    test('returns rating statistics', async () => {
      const user = await createTestUser({
        email: 'journey@example.com'
      })

      const rater1 = await createTestUser({
        email: 'rater1@example.com'
      })

      const rater2 = await createTestUser({
        email: 'rater2@example.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/journey.jpg'
      })

      // Get some ratings
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

      const response = await apiGet(`/info/journeyInfo/${user.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.totalRatings).toBe(2)
      expect(data.data.totalScore).toBeGreaterThan(0)
    })
  })
})
