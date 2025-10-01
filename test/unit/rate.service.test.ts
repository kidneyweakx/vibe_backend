import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { getTestDb, cleanDatabase, closeDatabase, createTestUser, createTestPhoto } from '../helpers/db'
import { ratePhoto } from '../../src/services/rate'
import { calculateTotalScore } from '../../src/services/rate/calculateTotalScore'
import { getRandomPhotosForRating } from '../../src/services/rate/getRandomPhotosForRating'
import { getJourneyDashboard } from '../../src/services/rate/journeyService'

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

  describe('getRandomPhotosForRating', () => {
    test('returns random photos for rating', async () => {
      const rater = await createTestUser({
        email: 'rater@random.com'
      })

      const owner1 = await createTestUser({
        email: 'owner1@random.com'
      })
      const owner2 = await createTestUser({
        email: 'owner2@random.com'
      })

      await createTestPhoto({
        userId: owner1.id,
        key: 'test/photo1.jpg'
      })
      await createTestPhoto({
        userId: owner2.id,
        key: 'test/photo2.jpg'
      })

      const photos = await getRandomPhotosForRating(rater.id, 2)

      expect(photos.length).toBeGreaterThan(0)
      expect(photos.length).toBeLessThanOrEqual(2)
      expect(photos[0].url).toBeDefined()
      expect(photos[0].user).toBeDefined()
    })

    test('excludes rater own photos', async () => {
      const rater = await createTestUser({
        email: 'rater@own.com'
      })

      // Create photo for rater
      await createTestPhoto({
        userId: rater.id,
        key: 'test/own-photo.jpg'
      })

      // Create photo for another user
      const other = await createTestUser({
        email: 'other@own.com'
      })
      await createTestPhoto({
        userId: other.id,
        key: 'test/other-photo.jpg'
      })

      const photos = await getRandomPhotosForRating(rater.id, 10)

      // Should only get other user's photo, not own
      const ownPhotos = photos.filter(p => p.userId === rater.id)
      expect(ownPhotos.length).toBe(0)
    })

    test('excludes already rated photos', async () => {
      const rater = await createTestUser({
        email: 'rater@rated.com'
      })

      const owner = await createTestUser({
        email: 'owner@rated.com'
      })

      const photo = await createTestPhoto({
        userId: owner.id,
        key: 'test/already-rated.jpg'
      })

      // Rate the photo
      await ratePhoto(rater.id, photo.id, 'like')

      // Try to get random photos
      const photos = await getRandomPhotosForRating(rater.id, 10)

      // Should not include the already rated photo
      const ratedPhoto = photos.find(p => p.id === photo.id)
      expect(ratedPhoto).toBeUndefined()
    })

    test('excludes guest users photos', async () => {
      const rater = await createTestUser({
        email: 'rater@guest.com'
      })

      const guestUser = await createTestUser({
        email: 'guest_123@guest.local',
        providerId: 'guest_123'
      })

      await createTestPhoto({
        userId: guestUser.id,
        key: 'test/guest-photo.jpg'
      })

      const photos = await getRandomPhotosForRating(rater.id, 10)

      // Should not include guest user photos
      const guestPhotos = photos.filter(p => p.userId.startsWith('guest'))
      expect(guestPhotos.length).toBe(0)
    })

    test('excludes profile pictures', async () => {
      const rater = await createTestUser({
        email: 'rater@profile.com'
      })

      const owner = await createTestUser({
        email: 'owner@profile.com'
      })

      // Create profile picture
      await createTestPhoto({
        userId: owner.id,
        key: 'profile-pictures/avatar.jpg'
      })

      // Create regular photo
      await createTestPhoto({
        userId: owner.id,
        key: 'test/regular.jpg'
      })

      const photos = await getRandomPhotosForRating(rater.id, 10)

      // Should only include regular photos, not profile pictures
      const profilePics = photos.filter(p => p.key.startsWith('profile-pictures/'))
      expect(profilePics.length).toBe(0)
    })

    test('excludes highly reported photos', async () => {
      const db = await getTestDb()
      const rater = await createTestUser({
        email: 'rater@reported.com'
      })

      const owner = await createTestUser({
        email: 'owner@reported.com'
      })

      const reportedPhoto = await createTestPhoto({
        userId: owner.id,
        key: 'test/reported.jpg'
      })

      // Create 2 reports (threshold for exclusion)
      await db.report.create({
        data: {
          photoId: reportedPhoto.id,
          reason: 'Inappropriate'
        }
      })
      await db.report.create({
        data: {
          photoId: reportedPhoto.id,
          reason: 'Spam'
        }
      })

      const photos = await getRandomPhotosForRating(rater.id, 10)

      // Should not include photos with >= 2 reports
      const foundReportedPhoto = photos.find(p => p.id === reportedPhoto.id)
      expect(foundReportedPhoto).toBeUndefined()
    })

    test('returns distinct photos per user', async () => {
      const rater = await createTestUser({
        email: 'rater@distinct.com'
      })

      const owner = await createTestUser({
        email: 'owner@distinct.com'
      })

      // Create multiple photos for same user
      await createTestPhoto({
        userId: owner.id,
        key: 'test/photo1.jpg'
      })
      await createTestPhoto({
        userId: owner.id,
        key: 'test/photo2.jpg'
      })
      await createTestPhoto({
        userId: owner.id,
        key: 'test/photo3.jpg'
      })

      const photos = await getRandomPhotosForRating(rater.id, 10)

      // Should only get one photo per user (distinct userId)
      const ownerPhotos = photos.filter(p => p.userId === owner.id)
      expect(ownerPhotos.length).toBeLessThanOrEqual(1)
    })

    test('respects limit parameter', async () => {
      const rater = await createTestUser({
        email: 'rater@limit.com'
      })

      // Create multiple users with photos
      for (let i = 0; i < 10; i++) {
        const owner = await createTestUser({
          email: `owner${i}@limit.com`
        })
        await createTestPhoto({
          userId: owner.id,
          key: `test/photo${i}.jpg`
        })
      }

      const photos = await getRandomPhotosForRating(rater.id, 3)

      expect(photos.length).toBeLessThanOrEqual(3)
    })

    test('handles empty results gracefully', async () => {
      const rater = await createTestUser({
        email: 'lonely@rater.com'
      })

      // No other photos available
      const photos = await getRandomPhotosForRating(rater.id, 10)

      expect(Array.isArray(photos)).toBe(true)
      expect(photos.length).toBe(0)
    })
  })

  describe('getJourneyDashboard', () => {
    test('returns complete journey dashboard', async () => {
      const user = await createTestUser({
        email: 'journey@test.com',
        name: 'Journey User'
      })

      const db = await getTestDb()

      // Update user with gender
      await db.user.update({
        where: { id: user.id },
        data: { gender: 'male' }
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/journey.jpg'
      })

      // Create some ratings
      const rater1 = await createTestUser({
        email: 'rater1@journey.com'
      })
      await db.user.update({
        where: { id: rater1.id },
        data: { gender: 'female' }
      })
      const rater2 = await createTestUser({
        email: 'rater2@journey.com'
      })
      await db.user.update({
        where: { id: rater2.id },
        data: { gender: 'male' }
      })

      await ratePhoto(rater1.id, photo.id, 'like')
      await ratePhoto(rater2.id, photo.id, 'normal')

      const dashboard = await getJourneyDashboard(user.id)

      expect(dashboard.userId).toBe(user.id)
      expect(dashboard.totalScore).toBeGreaterThanOrEqual(0)
      expect(dashboard.likeCount).toBe(1)
      expect(dashboard.normalCount).toBe(1)
      expect(dashboard.totalRatings).toBe(2)
      expect(dashboard.overallRank).toBeGreaterThanOrEqual(1)
      expect(dashboard.genderRank).toBeGreaterThanOrEqual(1)
      expect(dashboard.totalUsers).toBeGreaterThanOrEqual(1)
      expect(dashboard.femaleAttraction).toBeGreaterThanOrEqual(0)
      expect(dashboard.maleAttraction).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(dashboard.recentRatings)).toBe(true)
      expect(Array.isArray(dashboard.weeklyTrend)).toBe(true)
      expect(dashboard.weeklyTrend.length).toBe(7)
      expect(Array.isArray(dashboard.achievements)).toBe(true)
      expect(dashboard.levelProgress).toBeDefined()
    })

    test('throws error for non-existent user', async () => {
      await expect(
        getJourneyDashboard('nonexistent-user-id')
      ).rejects.toThrow('User not found')
    })

    test('handles user with no ratings', async () => {
      const user = await createTestUser({
        email: 'noratings@journey.com'
      })

      const dashboard = await getJourneyDashboard(user.id)

      expect(dashboard.totalScore).toBe(0)
      expect(dashboard.likeCount).toBe(0)
      expect(dashboard.normalCount).toBe(0)
      expect(dashboard.totalRatings).toBe(0)
      expect(dashboard.recentRatings.length).toBe(0)
    })

    test('calculates gender-specific attraction correctly', async () => {
      const db = await getTestDb()
      const user = await createTestUser({
        email: 'attraction@test.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/attraction.jpg'
      })

      // Female rater gives like
      const femaleRater = await createTestUser({
        email: 'female@rater.com'
      })
      await db.user.update({
        where: { id: femaleRater.id },
        data: { gender: 'female' }
      })
      await ratePhoto(femaleRater.id, photo.id, 'like')

      // Male rater gives normal
      const maleRater = await createTestUser({
        email: 'male@rater.com'
      })
      await db.user.update({
        where: { id: maleRater.id },
        data: { gender: 'male' }
      })
      await ratePhoto(maleRater.id, photo.id, 'normal')

      const dashboard = await getJourneyDashboard(user.id)

      // Female attraction should be higher (100% like)
      expect(dashboard.femaleAttraction).toBeGreaterThan(dashboard.maleAttraction)
      expect(dashboard.femaleAttraction).toBe(100)
      expect(dashboard.maleAttraction).toBe(20) // 0.2 weight for normal
    })

    test('generates achievements based on ratings', async () => {
      const db = await getTestDb()
      const user = await createTestUser({
        email: 'achievements@test.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/achievement.jpg'
      })

      // Create 15 likes to unlock achievements
      for (let i = 0; i < 15; i++) {
        const rater = await createTestUser({
          email: `rater${i}@achievement.com`
        })
        await ratePhoto(rater.id, photo.id, 'like')
      }

      const dashboard = await getJourneyDashboard(user.id)

      expect(dashboard.achievements.length).toBeGreaterThan(0)
      // Should have "Getting Started" achievement (10+ ratings)
      const gettingStarted = dashboard.achievements.find(
        a => a.id === 'first_10_ratings'
      )
      expect(gettingStarted).toBeDefined()
      expect(gettingStarted?.unlockedAt).not.toBeNull()
    })

    test('weekly trend shows 7 days of data', async () => {
      const user = await createTestUser({
        email: 'weekly@test.com'
      })

      const dashboard = await getJourneyDashboard(user.id)

      expect(dashboard.weeklyTrend.length).toBe(7)
      dashboard.weeklyTrend.forEach(day => {
        expect(day.date).toBeDefined()
        expect(day.score).toBeGreaterThanOrEqual(0)
        expect(day.ratingCount).toBeGreaterThanOrEqual(0)
      })
    })

    test('level progress calculates correctly', async () => {
      const db = await getTestDb()
      const user = await createTestUser({
        email: 'level@test.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/level.jpg'
      })

      // Create 5 likes (should give high score)
      for (let i = 0; i < 5; i++) {
        const rater = await createTestUser({
          email: `level-rater${i}@test.com`
        })
        await ratePhoto(rater.id, photo.id, 'like')
      }

      const dashboard = await getJourneyDashboard(user.id)

      expect(dashboard.levelProgress.currentLevel).toBeGreaterThanOrEqual(1)
      expect(dashboard.levelProgress.currentScore).toBe(100) // All likes
      expect(dashboard.levelProgress.progressPercentage).toBeGreaterThanOrEqual(0)
      expect(dashboard.levelProgress.progressPercentage).toBeLessThanOrEqual(100)
    })

    test('handles null gender correctly', async () => {
      const user = await createTestUser({
        email: 'nogender@test.com'
      })

      const dashboard = await getJourneyDashboard(user.id)

      expect(dashboard.genderRank).toBeNull()
    })

    test('next milestone is appropriate for user level', async () => {
      const user = await createTestUser({
        email: 'milestone@test.com'
      })

      const dashboard = await getJourneyDashboard(user.id)

      // New user should have a milestone
      if (dashboard.nextMilestone) {
        expect(dashboard.nextMilestone.title).toBeDefined()
        expect(dashboard.nextMilestone.targetValue).toBeGreaterThan(dashboard.nextMilestone.currentValue)
      }
    })
  })
})
