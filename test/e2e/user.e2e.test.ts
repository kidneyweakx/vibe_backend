import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { cleanDatabase, closeDatabase, createTestUser, createTestPhoto, createAuthenticatedTestUser } from '../helpers/db'
import { apiGet, apiPut, apiDelete, expectSuccess, expectError } from '../helpers/api'

describe('User E2E', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeDatabase()
  })

  describe('GET /api/user/profile/:id', () => {
    test('returns user profile', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'profile@example.com',
        name: 'Profile User'
      })

      const response = await apiGet(`/user/profile/${user.id}`, { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.id).toBe(user.id)
      expect(data.data.email).toBe('profile@example.com')
      expect(data.data.name).toBe('Profile User')
    })

    test('returns 403 when trying to view another user profile', async () => {
      const { token } = await createAuthenticatedTestUser({
        email: 'auth@example.com'
      })

      // Trying to view another user's profile should return 403
      const response = await apiGet('/user/profile/nonexistent', { token })
      await expectError(response, 403)
    })
  })

  describe('PUT /api/user/profile/:id', () => {
    test('updates user profile', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'update@example.com',
        name: 'Original Name'
      })

      const response = await apiPut(`/user/profile/${user.id}`, {
        name: 'Updated Name',
        bio: 'My bio',
        location: 'San Francisco'
      }, { token })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Updated Name')
      expect(data.data.bio).toBe('My bio')
      expect(data.data.location).toBe('San Francisco')
    })

    test('returns 403 when trying to update another user profile', async () => {
      const { token } = await createAuthenticatedTestUser({
        email: 'invalid@example.com'
      })

      // Trying to update another user's profile should return 403
      const response = await apiPut('/user/profile/invalid', {
        name: 'Test'
      }, { token })

      await expectError(response, 403)
    })
  })

  describe('GET /api/user/info/:id', () => {
    test('returns public user info with photo count', async () => {
      const user = await createTestUser({
        email: 'info@example.com',
        name: 'Info User'
      })

      // Add some photos
      await createTestPhoto({ userId: user.id, key: 'test/1.jpg' })
      await createTestPhoto({ userId: user.id, key: 'test/2.jpg' })

      const response = await apiGet(`/user/info/${user.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.user.id).toBe(user.id)
      expect(data.data.user.name).toBe('Info User')
      expect(data.data.stats.photoCount).toBe(2)
    })
  })

  describe('GET /api/user/share/:id', () => {
    test('generates shareable link', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'share@example.com'
      })

      const response = await apiGet(`/user/share/${user.id}`, { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.userId).toBe(user.id)
      expect(data.data.shareUrl).toContain(user.id)
    })
  })

  describe('GET /api/user/qr/:id', () => {
    test('generates QR code data', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'qr@example.com',
        name: 'QR User'
      })

      const response = await apiGet(`/user/qr/${user.id}`, { token })
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.qrText).toBeDefined()
      expect(data.data.displayUrl).toContain(user.id)
      expect(data.data.userName).toBe('QR User')
    })
  })
})
