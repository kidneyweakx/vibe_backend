import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { cleanDatabase, closeDatabase, createTestUser, createTestPhoto } from '../helpers/db'
import { apiGet, apiPost, apiDelete, expectSuccess, expectError } from '../helpers/api'

describe('File E2E', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeDatabase()
  })

  describe('POST /api/file/presign', () => {
    test('creates presigned URL with userId', async () => {
      const user = await createTestUser({
        email: 'presign@example.com',
        name: 'Presign User'
      })

      const response = await apiPost('/file/presign', {
        userId: user.id,
        contentType: 'image/jpeg'
      })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.url).toBeDefined()
      expect(data.data.key).toBeDefined()
      expect(data.data.headers).toBeDefined()
      expect(data.data.headers['Content-Type']).toContain('image/')
    })

    test('creates presigned URL with custom key', async () => {
      const user = await createTestUser({
        email: 'presign-key@example.com'
      })

      const customKey = `${user.id}/custom-photo.jpg`
      const response = await apiPost('/file/presign', {
        userId: user.id,
        key: customKey,
        contentType: 'image/jpeg'
      })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.key).toBe(customKey)
    })

    test('requires userId', async () => {
      const response = await apiPost('/file/presign', {
        contentType: 'image/jpeg'
      })

      await expectError(response, 422)
    })

    test('handles different content types', async () => {
      const user = await createTestUser({
        email: 'presign-png@example.com'
      })

      const response = await apiPost('/file/presign', {
        userId: user.id,
        contentType: 'image/png'
      })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.headers['Content-Type']).toBe('image/png')
    })
  })

  describe('POST /api/file/photos/upload', () => {
    test('uploads photo with base64 data', async () => {
      const user = await createTestUser({
        email: 'upload@example.com'
      })

      // Small test base64 image (1x1 pixel PNG)
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      const response = await apiPost('/file/photos/upload', {
        userId: user.id,
        imageData: base64Image,
        format: 'png'
      })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.id).toBeDefined()
      expect(data.data.userId).toBe(user.id)
    })

    test('requires userId', async () => {
      const response = await apiPost('/file/photos/upload', {
        imageData: 'data:image/png;base64,abc123'
      })

      await expectError(response, 422)
    })

    test('requires imageData', async () => {
      const user = await createTestUser({
        email: 'upload-no-data@example.com'
      })

      const response = await apiPost('/file/photos/upload', {
        userId: user.id
      })

      await expectError(response, 422)
    })
  })

  describe('POST /api/file/photos/complete', () => {
    test('confirms photo upload', async () => {
      const user = await createTestUser({
        email: 'complete@example.com'
      })

      const photoKey = `${user.id}/test-photo.jpg`

      const response = await apiPost('/file/photos/complete', {
        userId: user.id,
        key: photoKey,
        contentType: 'image/jpeg',
        sizeBytes: 100000
      })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.id).toBeDefined()
      expect(data.data.key).toBe(photoKey)
    })

    test('infers format from key extension', async () => {
      const user = await createTestUser({
        email: 'complete-png@example.com'
      })

      const response = await apiPost('/file/photos/complete', {
        userId: user.id,
        key: `${user.id}/test-photo.png`
      })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.format).toBe('png')
    })

    test('requires userId', async () => {
      const response = await apiPost('/file/photos/complete', {
        key: 'test/photo.jpg'
      })

      await expectError(response, 422)
    })

    test('requires key', async () => {
      const user = await createTestUser({
        email: 'complete-no-key@example.com'
      })

      const response = await apiPost('/file/photos/complete', {
        userId: user.id
      })

      await expectError(response, 422)
    })
  })

  describe('GET /api/file/photos/user/:userId', () => {
    test('returns user photos with pagination', async () => {
      const user = await createTestUser({
        email: 'get-photos@example.com'
      })

      // Create multiple photos
      await createTestPhoto({ userId: user.id, key: 'test/photo1.jpg' })
      await createTestPhoto({ userId: user.id, key: 'test/photo2.jpg' })
      await createTestPhoto({ userId: user.id, key: 'test/photo3.jpg' })

      const response = await apiGet(`/file/photos/user/${user.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(3)
      expect(data.data[0].userId).toBe(user.id)
    })

    test('supports pagination with page and limit', async () => {
      const user = await createTestUser({
        email: 'paginate@example.com'
      })

      // Create 5 photos
      for (let i = 1; i <= 5; i++) {
        await createTestPhoto({ userId: user.id, key: `test/photo${i}.jpg` })
      }

      const response = await apiGet(`/file/photos/user/${user.id}?page=1&limit=2`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(2)
    })

    test('returns empty array for user with no photos', async () => {
      const user = await createTestUser({
        email: 'no-photos@example.com'
      })

      const response = await apiGet(`/file/photos/user/${user.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(0)
    })
  })

  describe('DELETE /api/file/photos/:photoId', () => {
    test('deletes photo successfully', async () => {
      const user = await createTestUser({
        email: 'delete@example.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/delete-me.jpg'
      })

      const response = await apiDelete(`/file/photos/${photo.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)

      // Verify photo is deleted
      const getResponse = await apiGet(`/file/photos/user/${user.id}`)
      const getData = await expectSuccess(getResponse)
      expect(getData.data.length).toBe(0)
    })

    test('returns 404 for nonexistent photo', async () => {
      const response = await apiDelete('/file/photos/nonexistent-id')
      await expectError(response, 404)
    })
  })

  describe('POST /api/file/report', () => {
    test('creates report for photo', async () => {
      const owner = await createTestUser({
        email: 'photo-owner@example.com'
      })

      const reporter = await createTestUser({
        email: 'reporter@example.com'
      })

      const photo = await createTestPhoto({
        userId: owner.id,
        key: 'test/reported.jpg'
      })

      const response = await apiPost('/file/report', {
        photoId: photo.id,
        reporterId: reporter.id,
        reason: 'inappropriate content'
      })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.id).toBeDefined()
    })

    test('creates anonymous report without reporterId', async () => {
      const owner = await createTestUser({
        email: 'photo-owner2@example.com'
      })

      const photo = await createTestPhoto({
        userId: owner.id,
        key: 'test/reported2.jpg'
      })

      const response = await apiPost('/file/report', {
        photoId: photo.id,
        reason: 'spam'
      })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.id).toBeDefined()
    })

    test('requires photoId', async () => {
      const response = await apiPost('/file/report', {
        reason: 'test'
      })

      await expectError(response, 422)
    })

    test('requires reason', async () => {
      const response = await apiPost('/file/report', {
        photoId: 'test-id'
      })

      await expectError(response, 422)
    })

    test('allows multiple reports on same photo', async () => {
      const owner = await createTestUser({
        email: 'photo-owner3@example.com'
      })

      const reporter1 = await createTestUser({
        email: 'reporter1@example.com'
      })

      const reporter2 = await createTestUser({
        email: 'reporter2@example.com'
      })

      const photo = await createTestPhoto({
        userId: owner.id,
        key: 'test/reported3.jpg'
      })

      // First report
      const response1 = await apiPost('/file/report', {
        photoId: photo.id,
        reporterId: reporter1.id,
        reason: 'reason 1'
      })

      const data1 = await expectSuccess(response1)
      expect(data1.success).toBe(true)

      // Second report
      const response2 = await apiPost('/file/report', {
        photoId: photo.id,
        reporterId: reporter2.id,
        reason: 'reason 2'
      })

      const data2 = await expectSuccess(response2)
      expect(data2.success).toBe(true)
      expect(data2.data.id).not.toBe(data1.data.id)
    })
  })
})
