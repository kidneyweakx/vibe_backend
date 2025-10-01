import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { getTestDb, cleanDatabase, closeDatabase, createTestUser, createTestPhoto } from '../helpers/db'
import { confirmPhotoUpload, getUserPhotos, createReport, aggregateReportedPhotos } from '../../src/services/file'

describe('File Service', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeDatabase()
  })

  describe('confirmPhotoUpload', () => {
    test('creates photo record', async () => {
      const user = await createTestUser({
        email: 'uploader@example.com'
      })

      const result = await confirmPhotoUpload({
        userId: user.id,
        key: 'user123/photo.jpg',
        format: 'jpg',
        size: 50000
      })

      expect(result.photoId).toBeDefined()
      expect(result.urls.original).toBeDefined()
      expect(result.uploadedAt).toBeDefined()

      // Verify photo was created in database
      const db = await getTestDb()
      const photo = await db.photo.findUnique({
        where: { id: result.photoId }
      })
      expect(photo).toBeDefined()
      expect(photo!.userId).toBe(user.id)
      expect(photo!.key).toBe('user123/photo.jpg')
    })

    test('fails with invalid user', async () => {
      await expect(
        confirmPhotoUpload({
          userId: 'nonexistent',
          key: 'test.jpg',
          format: 'jpg'
        })
      ).rejects.toThrow()
    })
  })

  describe('getUserPhotos', () => {
    test('returns user photos with pagination', async () => {
      const user = await createTestUser({
        email: 'multi-photo@example.com'
      })

      // Create 5 photos
      for (let i = 1; i <= 5; i++) {
        await createTestPhoto({
          userId: user.id,
          key: `test/photo${i}.jpg`
        })
      }

      const result = await getUserPhotos(user.id, 1, 3)

      expect(result.photos.length).toBe(3)
      expect(result.totalCount).toBe(5)
      expect(result.hasMore).toBe(true)
    })

    test('returns empty for user with no photos', async () => {
      const user = await createTestUser({
        email: 'no-photos@example.com'
      })

      const result = await getUserPhotos(user.id, 1, 10)

      expect(result.photos.length).toBe(0)
      expect(result.totalCount).toBe(0)
      expect(result.hasMore).toBe(false)
    })

    test('handles page out of range', async () => {
      const user = await createTestUser({
        email: 'page-test@example.com'
      })

      await createTestPhoto({
        userId: user.id,
        key: 'test/single.jpg'
      })

      const result = await getUserPhotos(user.id, 10, 10)

      expect(result.photos.length).toBe(0)
      expect(result.hasMore).toBe(false)
    })
  })

  describe('createReport and aggregateReportedPhotos', () => {
    test('creates photo report', async () => {
      const reporter = await createTestUser({
        email: 'reporter@example.com'
      })

      const photoOwner = await createTestUser({
        email: 'reported@example.com'
      })

      const photo = await createTestPhoto({
        userId: photoOwner.id,
        key: 'test/reported.jpg'
      })

      const report = await createReport({
        photoId: photo.id,
        reporterId: reporter.id,
        reason: 'Inappropriate content'
      })

      expect(report.id).toBeDefined()
      expect(report.photoId).toBe(photo.id)
      expect(report.reporterId).toBe(reporter.id)
      expect(report.reason).toBe('Inappropriate content')
    })

    test('allows anonymous reporting', async () => {
      const photoOwner = await createTestUser({
        email: 'anonymous-report@example.com'
      })

      const photo = await createTestPhoto({
        userId: photoOwner.id,
        key: 'test/anon.jpg'
      })

      const report = await createReport({
        photoId: photo.id,
        reason: 'Spam'
      })

      expect(report.reporterId).toBeNull()
    })

    test('aggregates reported photos correctly', async () => {
      const owner = await createTestUser({
        email: 'multi-report@example.com'
      })

      const photo1 = await createTestPhoto({
        userId: owner.id,
        key: 'test/report1.jpg'
      })

      const photo2 = await createTestPhoto({
        userId: owner.id,
        key: 'test/report2.jpg'
      })

      // Photo1 gets 3 reports (should appear)
      await createReport({ photoId: photo1.id, reason: 'Report 1' })
      await createReport({ photoId: photo1.id, reason: 'Report 2' })
      await createReport({ photoId: photo1.id, reason: 'Report 3' })

      // Photo2 gets 1 report (should not appear with minReports=2)
      await createReport({ photoId: photo2.id, reason: 'Single report' })

      const aggregated = await aggregateReportedPhotos(2, 1, 10)

      expect(aggregated.length).toBe(1)
      expect(aggregated[0].photo.id).toBe(photo1.id)
      expect(aggregated[0].reportCount).toBe(3)
    })
  })
})
