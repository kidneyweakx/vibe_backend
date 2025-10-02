import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { cleanDatabase, closeDatabase, createTestUser, createTestPhoto, createAuthenticatedTestUser } from '../helpers/db'
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
      const { user, token } = await createAuthenticatedTestUser({
        email: 'presign@example.com',
        name: 'Presign User'
      })

      const response = await apiPost('/file/presign', {
        contentType: 'image/jpeg'
      }, { token })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.url).toBeDefined()
      expect(data.data.key).toBeDefined()
      expect(data.data.headers).toBeDefined()
      expect(data.data.headers['Content-Type']).toContain('image/')
    })

    test('creates presigned URL with custom key', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'presign-key@example.com'
      })

      const customKey = `${user.id}/custom-photo.jpg`
      const response = await apiPost('/file/presign', {
        key: customKey,
        contentType: 'image/jpeg'
      }, { token })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.key).toBe(customKey)
    })

    test('requires authentication', async () => {
      const response = await apiPost('/file/presign', {
        contentType: 'image/jpeg'
      })

      await expectError(response, 401)
    })

    test('handles different content types', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'presign-png@example.com'
      })

      const response = await apiPost('/file/presign', {
        contentType: 'image/png'
      }, { token })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.headers['Content-Type']).toBe('image/png')
    })
  })

  describe('POST /api/file/photos/upload', () => {
    test('uploads photo with base64 data', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'upload@example.com'
      })

      // Small test base64 image (1x1 pixel PNG)
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      const response = await apiPost('/file/photos/upload', {
        imageData: base64Image,
        format: 'png'
      }, { token })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.id).toBeDefined()
      expect(data.data.userId).toBe(user.id)
    })

    test('requires authentication', async () => {
      const response = await apiPost('/file/photos/upload', {
        imageData: 'data:image/png;base64,abc123'
      })

      await expectError(response, 401)
    })

    test('requires imageData', async () => {
      const { token } = await createAuthenticatedTestUser({
        email: 'upload-no-data@example.com'
      })

      const response = await apiPost('/file/photos/upload', {
      }, { token })

      await expectError(response, 400)
    })
  })

  describe('POST /api/file/photos/complete', () => {
    test('confirms photo upload', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'complete@example.com'
      })

      const photoKey = `${user.id}/test-photo.jpg`

      const response = await apiPost('/file/photos/complete', {
        key: photoKey,
        contentType: 'image/jpeg',
        sizeBytes: 100000
      }, { token })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.id).toBeDefined()
      expect(data.data.key).toBe(photoKey)
    })

    test('infers format from key extension', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'complete-png@example.com'
      })

      const response = await apiPost('/file/photos/complete', {
        key: `${user.id}/test-photo.png`
      }, { token })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.format).toBe('png')
    })

    test('requires authentication', async () => {
      const response = await apiPost('/file/photos/complete', {
        key: 'test/photo.jpg'
      })

      await expectError(response, 401)
    })

    test('requires key', async () => {
      const { token } = await createAuthenticatedTestUser({
        email: 'complete-no-key@example.com'
      })

      const response = await apiPost('/file/photos/complete', {
      }, { token })

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
      const { user, token } = await createAuthenticatedTestUser({
        email: 'delete@example.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/delete-me.jpg'
      })

      const response = await apiDelete(`/file/photos/${photo.id}`, { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)

      // Verify photo is deleted
      const getResponse = await apiGet(`/file/photos/user/${user.id}`)
      const getData = await expectSuccess(getResponse)
      expect(getData.data.length).toBe(0)
    })

    test('requires authentication', async () => {
      const user = await createTestUser({
        email: 'delete-no-auth@example.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/delete-me.jpg'
      })

      const response = await apiDelete(`/file/photos/${photo.id}`)
      await expectError(response, 401)
    })

    test('returns 404 for nonexistent photo', async () => {
      const { token } = await createAuthenticatedTestUser({
        email: 'delete-not-found@example.com'
      })

      const response = await apiDelete('/file/photos/nonexistent-id', { token })
      await expectError(response, 404)
    })
  })

  describe('POST /api/file/report', () => {
    test('creates report for photo', async () => {
      const owner = await createTestUser({
        email: 'photo-owner@example.com'
      })

      const { user: reporter, token } = await createAuthenticatedTestUser({
        email: 'reporter@example.com'
      })

      const photo = await createTestPhoto({
        userId: owner.id,
        key: 'test/reported.jpg'
      })

      const response = await apiPost('/file/report', {
        photoId: photo.id,
        reason: 'inappropriate content'
      }, { token })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.id).toBeDefined()
    })

    test('creates report from authenticated user', async () => {
      const owner = await createTestUser({
        email: 'photo-owner2@example.com'
      })

      const { token } = await createAuthenticatedTestUser({
        email: 'reporter2@example.com'
      })

      const photo = await createTestPhoto({
        userId: owner.id,
        key: 'test/reported2.jpg'
      })

      const response = await apiPost('/file/report', {
        photoId: photo.id,
        reason: 'spam'
      }, { token })

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

      const { token: token1 } = await createAuthenticatedTestUser({
        email: 'reporter1@example.com'
      })

      const { token: token2 } = await createAuthenticatedTestUser({
        email: 'reporter2@example.com'
      })

      const photo = await createTestPhoto({
        userId: owner.id,
        key: 'test/reported3.jpg'
      })

      // First report
      const response1 = await apiPost('/file/report', {
        photoId: photo.id,
        reason: 'reason 1'
      }, { token: token1 })

      const data1 = await expectSuccess(response1)
      expect(data1.success).toBe(true)

      // Second report
      const response2 = await apiPost('/file/report', {
        photoId: photo.id,
        reason: 'reason 2'
      }, { token: token2 })

      const data2 = await expectSuccess(response2)
      expect(data2.success).toBe(true)
      expect(data2.data.id).not.toBe(data1.data.id)
    })
  })
})
