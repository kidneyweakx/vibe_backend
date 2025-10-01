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
