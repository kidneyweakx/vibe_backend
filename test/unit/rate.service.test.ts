import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { getTestDb, cleanDatabase, closeDatabase, createTestUser, createTestPhoto } from '../helpers/db'
import { ratePhoto } from '../../src/services/rate'
import { calculateTotalScore } from '../../src/services/rate/calculateTotalScore'

describe('Rate Service', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeDatabase()
  })

  describe('calculateTotalScore', () => {
    test('calculates score correctly', () => {
      // Formula: (likeCount * 1 + normalCount * 0.2) / totalVotes * 100
      expect(calculateTotalScore(10, 5)).toBe(73) // (10*1 + 5*0.2) / 15 * 100 = 73
      expect(calculateTotalScore(0, 10)).toBe(20) // (0*1 + 10*0.2) / 10 * 100 = 20
      expect(calculateTotalScore(5, 0)).toBe(100) // (5*1 + 0*0.2) / 5 * 100 = 100
      expect(calculateTotalScore(0, 0)).toBe(0)
    })
  })

  describe('ratePhoto', () => {
    test('creates like rating successfully', async () => {
      const rater = await createTestUser({
        email: 'rater@example.com'
      })

      const photoOwner = await createTestUser({
        email: 'owner@example.com'
      })

      const photo = await createTestPhoto({
        userId: photoOwner.id,
        key: 'test/rated.jpg'
      })

      const result = await ratePhoto(rater.id, photo.id, 'like')

      expect(result.success).toBe(true)

      // Verify rating was created
      const db = await getTestDb()
      const rating = await db.rating.findUnique({
        where: {
          raterId_photoId: {
            raterId: rater.id,
            photoId: photo.id
          }
        }
      })

      expect(rating).toBeDefined()
      expect(rating!.type).toBe('like')
      expect(rating!.ratedUserId).toBe(photoOwner.id)
    })

    test('creates normal rating successfully', async () => {
      const rater = await createTestUser({
        email: 'rater2@example.com'
      })

      const photoOwner = await createTestUser({
        email: 'owner2@example.com'
      })

      const photo = await createTestPhoto({
        userId: photoOwner.id,
        key: 'test/normal.jpg'
      })

      const result = await ratePhoto(rater.id, photo.id, 'normal')

      expect(result.success).toBe(true)

      const db = await getTestDb()
      const rating = await db.rating.findFirst({
        where: {
          raterId: rater.id,
          photoId: photo.id
        }
      })

      expect(rating!.type).toBe('normal')
    })

    test('prevents rating same photo twice', async () => {
      const rater = await createTestUser({
        email: 'rater3@example.com'
      })

      const photoOwner = await createTestUser({
        email: 'owner3@example.com'
      })

      const photo = await createTestPhoto({
        userId: photoOwner.id,
        key: 'test/duplicate.jpg'
      })

      // First rating
      await ratePhoto(rater.id, photo.id, 'like')

      // Second rating should fail
      const result = await ratePhoto(rater.id, photo.id, 'normal')

      expect(result.success).toBe(false)
      expect(result.error).toContain('already rated')
    })

    test('prevents rating own photo', async () => {
      const user = await createTestUser({
        email: 'self@example.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/self.jpg'
      })

      const result = await ratePhoto(user.id, photo.id, 'like')

      expect(result.success).toBe(false)
      expect(result.error).toContain('own photo')
    })

    test('fails when photo does not exist', async () => {
      const rater = await createTestUser({
        email: 'rater4@example.com'
      })

      const result = await ratePhoto(rater.id, 'nonexistent-photo', 'like')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    test('tracks score changes correctly', async () => {
      const rater1 = await createTestUser({
        email: 'rater-a@example.com'
      })

      const rater2 = await createTestUser({
        email: 'rater-b@example.com'
      })

      const photoOwner = await createTestUser({
        email: 'scorer@example.com'
      })

      const photo = await createTestPhoto({
        userId: photoOwner.id,
        key: 'test/score.jpg'
      })

      // Rate with 2 likes and 1 normal
      await ratePhoto(rater1.id, photo.id, 'like')
      await ratePhoto(rater2.id, photo.id, 'normal')

      const rater3 = await createTestUser({
        email: 'rater-c@example.com'
      })
      await ratePhoto(rater3.id, photo.id, 'like')

      // Check total score: 2 likes + 1 normal
      // Formula: (2*1 + 1*0.2) / 3 * 100 = 73
      const db = await getTestDb()
      const likes = await db.rating.count({
        where: { photoId: photo.id, type: 'like' }
      })
      const normals = await db.rating.count({
        where: { photoId: photo.id, type: 'normal' }
      })

      expect(likes).toBe(2)
      expect(normals).toBe(1)
      expect(calculateTotalScore(likes, normals)).toBe(73)
    })
  })
})
