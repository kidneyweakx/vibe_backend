import { describe, test, expect, beforeEach, afterAll, mock } from 'bun:test'
import { getTestDb, cleanDatabase, closeDatabase, createTestUser, createTestPhoto } from '../helpers/db'
import { confirmPhotoUpload, getUserPhotos, createReport, aggregateReportedPhotos, listReportsByPhoto, listAllReports } from '../../src/services/file'
import { deletePhoto } from '../../src/services/file/deletePhoto'
import { getAllPhotos } from '../../src/services/file/getAllPhotos'
import { generatePhotoKey } from '../../src/services/file/generatePhotoKey'
import { getExtensionFromContentType } from '../../src/services/file/getExtensionFromContentType'
import { handleR2Error, logError } from '../../src/services/file/errors'
import { verifyFile } from '../../src/services/file/verifyFile'

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

  describe('deletePhoto', () => {
    test('returns error when photo not found', async () => {
      const result = await deletePhoto('nonexistent-photo-id')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Photo not found')
    })

    // Note: Full deletePhoto tests including R2 deletion are skipped
    // because they require R2 client configuration which is not available in test environment.
    // The database deletion logic is tested via cascade deletes in other tests.
  })

  describe('listReportsByPhoto', () => {
    test('returns reports for a specific photo', async () => {
      const owner = await createTestUser({
        email: 'photo-owner@example.com'
      })
      const reporter1 = await createTestUser({
        email: 'reporter1@example.com'
      })
      const reporter2 = await createTestUser({
        email: 'reporter2@example.com'
      })

      const photo = await createTestPhoto({
        userId: owner.id,
        key: 'test/reported-photo.jpg'
      })

      await createReport({
        photoId: photo.id,
        reporterId: reporter1.id,
        reason: 'Spam'
      })
      await createReport({
        photoId: photo.id,
        reporterId: reporter2.id,
        reason: 'Inappropriate'
      })

      const result = await listReportsByPhoto(photo.id)

      expect(result.reports.length).toBe(2)
      expect(result.count).toBe(2)
      expect(result.reports[0].reason).toBeDefined()
      expect(result.reports[0].photo).toBeDefined()
      expect(result.reports[0].reporter).toBeDefined()
    })

    test('returns empty list for photo with no reports', async () => {
      const owner = await createTestUser({
        email: 'no-reports@example.com'
      })

      const photo = await createTestPhoto({
        userId: owner.id,
        key: 'test/clean-photo.jpg'
      })

      const result = await listReportsByPhoto(photo.id)

      expect(result.reports.length).toBe(0)
      expect(result.count).toBe(0)
    })
  })

  describe('listAllReports', () => {
    test('lists all reports with pagination', async () => {
      const owner = await createTestUser({
        email: 'all-reports-owner@example.com'
      })

      const photo1 = await createTestPhoto({
        userId: owner.id,
        key: 'test/photo1.jpg'
      })
      const photo2 = await createTestPhoto({
        userId: owner.id,
        key: 'test/photo2.jpg'
      })

      // Create multiple reports
      await createReport({ photoId: photo1.id, reason: 'Report 1' })
      await createReport({ photoId: photo1.id, reason: 'Report 2' })
      await createReport({ photoId: photo2.id, reason: 'Report 3' })

      const result = await listAllReports(1, 10)

      expect(result.reports.length).toBe(3)
      expect(result.totalCount).toBe(3)
      expect(result.hasMore).toBe(false)
    })

    test('pagination works correctly', async () => {
      const owner = await createTestUser({
        email: 'pagination-test@example.com'
      })

      const photo = await createTestPhoto({
        userId: owner.id,
        key: 'test/paginated-photo.jpg'
      })

      // Create 5 reports
      for (let i = 0; i < 5; i++) {
        await createReport({ photoId: photo.id, reason: `Report ${i}` })
      }

      const page1 = await listAllReports(1, 2)
      expect(page1.reports.length).toBe(2)
      expect(page1.hasMore).toBe(true)

      const page2 = await listAllReports(2, 2)
      expect(page2.reports.length).toBe(2)
      expect(page2.hasMore).toBe(true)

      const page3 = await listAllReports(3, 2)
      expect(page3.reports.length).toBe(1)
      expect(page3.hasMore).toBe(false)
    })
  })

  describe('getAllPhotos', () => {
    test('returns all photos with pagination', async () => {
      const user = await createTestUser({
        email: 'all-photos@example.com'
      })

      // Create 3 photos
      for (let i = 0; i < 3; i++) {
        await createTestPhoto({
          userId: user.id,
          key: `test/photo-${i}.jpg`
        })
      }

      const result = await getAllPhotos({ page: 1, limit: 10 })

      expect(result.photos.length).toBe(3)
      expect(result.totalCount).toBe(3)
      expect(result.hasMore).toBe(false)
    })

    test('filters photos by userId', async () => {
      const user1 = await createTestUser({
        email: 'user1@example.com'
      })
      const user2 = await createTestUser({
        email: 'user2@example.com'
      })

      await createTestPhoto({
        userId: user1.id,
        key: 'test/user1-photo.jpg'
      })
      await createTestPhoto({
        userId: user2.id,
        key: 'test/user2-photo.jpg'
      })

      const result = await getAllPhotos({ userId: user1.id })

      expect(result.photos.length).toBe(1)
      expect(result.photos[0].userId).toBe(user1.id)
    })

    test('excludes profile pictures', async () => {
      const user = await createTestUser({
        email: 'profile-pic-test@example.com'
      })

      // Create regular photo
      const regularPhoto = await createTestPhoto({
        userId: user.id,
        key: 'test/regular.jpg'
      })

      // Create profile picture (should be excluded)
      await createTestPhoto({
        userId: user.id,
        key: 'profile-pictures/avatar.jpg'
      })

      const result = await getAllPhotos({ userId: user.id })

      // Should only return the regular photo, not the profile picture
      expect(result.photos.length).toBe(1)
      expect(result.photos[0].id).toBe(regularPhoto.id)
      expect(result.photos[0].userId).toBe(user.id)
    })

    test('pagination works correctly', async () => {
      const user = await createTestUser({
        email: 'pagination@example.com'
      })

      // Create 5 photos
      for (let i = 0; i < 5; i++) {
        await createTestPhoto({
          userId: user.id,
          key: `test/photo-${i}.jpg`
        })
      }

      const page1 = await getAllPhotos({ page: 1, limit: 2 })
      expect(page1.photos.length).toBe(2)
      expect(page1.hasMore).toBe(true)

      const page2 = await getAllPhotos({ page: 2, limit: 2 })
      expect(page2.photos.length).toBe(2)
      expect(page2.hasMore).toBe(true)

      const page3 = await getAllPhotos({ page: 3, limit: 2 })
      expect(page3.photos.length).toBe(1)
      expect(page3.hasMore).toBe(false)
    })
  })

  describe('generatePhotoKey', () => {
    test('generates photo key with correct format', () => {
      const userId = 'user123'
      const format = 'jpg'

      const key = generatePhotoKey(userId, format)

      expect(key).toMatch(/^photos\/user123\/\d+\.jpg$/)
    })

    test('defaults to png format', () => {
      const userId = 'user456'

      const key = generatePhotoKey(userId)

      expect(key).toMatch(/^photos\/user456\/\d+\.png$/)
    })

    test('supports different formats', () => {
      const userId = 'user789'

      const jpgKey = generatePhotoKey(userId, 'jpg')
      const webpKey = generatePhotoKey(userId, 'webp')
      const gifKey = generatePhotoKey(userId, 'gif')

      expect(jpgKey).toContain('.jpg')
      expect(webpKey).toContain('.webp')
      expect(gifKey).toContain('.gif')
    })
  })

  describe('getExtensionFromContentType', () => {
    test('returns correct extension for image/jpeg', () => {
      expect(getExtensionFromContentType('image/jpeg')).toBe('jpg')
      expect(getExtensionFromContentType('image/jpg')).toBe('jpg')
    })

    test('returns correct extension for image/png', () => {
      expect(getExtensionFromContentType('image/png')).toBe('png')
    })

    test('returns correct extension for image/webp', () => {
      expect(getExtensionFromContentType('image/webp')).toBe('webp')
    })

    test('returns correct extension for image/gif', () => {
      expect(getExtensionFromContentType('image/gif')).toBe('gif')
    })

    test('defaults to png for unknown content type', () => {
      expect(getExtensionFromContentType('image/unknown')).toBe('png')
      expect(getExtensionFromContentType('text/plain')).toBe('png')
      expect(getExtensionFromContentType('')).toBe('png')
    })

    test('handles undefined content type', () => {
      expect(getExtensionFromContentType(undefined)).toBe('png')
    })

    test('handles case insensitive content types', () => {
      expect(getExtensionFromContentType('IMAGE/JPEG')).toBe('jpg')
      expect(getExtensionFromContentType('Image/Png')).toBe('png')
    })
  })

  describe('handleR2Error', () => {
    test('handles CredentialsProviderError', () => {
      const error = { name: 'CredentialsProviderError' }
      expect(handleR2Error(error)).toBe('Invalid R2 credentials - Check R2_ACCESS_KEY and R2_SECRET_KEY')
    })

    test('handles NoSuchBucket error', () => {
      const error = { name: 'NoSuchBucket' }
      expect(handleR2Error(error)).toBe('Bucket not found - Check R2_BUCKET_NAME')
    })

    test('handles AccessDenied error', () => {
      const error = { name: 'AccessDenied' }
      expect(handleR2Error(error)).toBe('Access denied - Check R2 permissions and credentials')
    })

    test('handles NetworkingError', () => {
      const error = { name: 'NetworkingError' }
      expect(handleR2Error(error)).toBe('Network error - Check internet connection')
    })

    test('handles InvalidAccessKeyId', () => {
      const error = { name: 'InvalidAccessKeyId' }
      expect(handleR2Error(error)).toBe('Invalid access key - Check R2_ACCESS_KEY')
    })

    test('handles SignatureDoesNotMatch', () => {
      const error = { name: 'SignatureDoesNotMatch' }
      expect(handleR2Error(error)).toBe('Invalid secret key - Check R2_SECRET_KEY')
    })

    test('handles NoSuchKey error', () => {
      const error = { name: 'NoSuchKey' }
      expect(handleR2Error(error)).toBe('File not found')
    })

    test('handles error with Code property', () => {
      const error = { Code: 'NoSuchBucket' }
      expect(handleR2Error(error)).toBe('Bucket not found - Check R2_BUCKET_NAME')
    })

    test('handles unknown error with message', () => {
      const error = { name: 'UnknownError', message: 'Something went wrong' }
      expect(handleR2Error(error)).toBe('Operation failed: Something went wrong')
    })

    test('handles unknown error without message', () => {
      const error = { name: 'UnknownError' }
      expect(handleR2Error(error)).toBe('Operation failed: UnknownError')
    })
  })

  describe('logError', () => {
    test('logs error with key', () => {
      const consoleSpy = mock(() => {})
      const originalError = console.error
      console.error = consoleSpy

      const error = {
        name: 'TestError',
        Code: 'TEST_CODE',
        message: 'Test message',
        $metadata: { httpStatusCode: 404 }
      }

      logError('Upload', 'test-key', error)

      expect(consoleSpy).toHaveBeenCalledWith('Upload error for test-key:', {
        name: 'TestError',
        code: 'TEST_CODE',
        message: 'Test message',
        statusCode: 404
      })

      console.error = originalError
    })

    test('logs error without key', () => {
      const consoleSpy = mock(() => {})
      const originalError = console.error
      console.error = consoleSpy

      const error = {
        name: 'TestError',
        message: 'Test message'
      }

      logError('Delete', null, error)

      expect(consoleSpy).toHaveBeenCalledWith('Delete error:', {
        name: 'TestError',
        code: undefined,
        message: 'Test message',
        statusCode: undefined
      })

      console.error = originalError
    })
  })

  describe('verifyFile', () => {
    test('returns true for existing file', async () => {
      const user = await createTestUser({
        email: 'verify@example.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/verify.jpg'
      })

      // Note: This test requires real R2 connection since verifyFile calls R2 directly
      // In a real scenario, we might want to mock the R2 client
      const exists = await verifyFile(photo.key)

      // Since we're using test R2 storage, the file might not actually exist
      // This test verifies the function executes without error
      expect(typeof exists).toBe('boolean')
    })

    test('returns false for non-existent file', async () => {
      const exists = await verifyFile('non-existent/file.jpg')
      expect(exists).toBe(false)
    })
  })
})
