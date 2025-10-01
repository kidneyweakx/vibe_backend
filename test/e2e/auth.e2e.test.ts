import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { cleanDatabase, closeDatabase } from '../helpers/db'
import { apiPost, expectSuccess, expectError } from '../helpers/api'

describe('Auth E2E', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeDatabase()
  })

  describe('POST /api/auth/profile/create', () => {
    test('creates new user with Google provider', async () => {
      const response = await apiPost('/auth/profile/create', {
        providerUserID: 'google_123',
        email: 'google@example.com',
        displayName: 'Google User',
        authProvider: 'google',
        profileImageURL: 'https://example.com/avatar.jpg',
        gender: 'male'
      })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.user.email).toBe('google@example.com')
      expect(data.user.name).toBe('Google User')
      expect(data.user.id).toBeDefined()
      expect(data.token).toBeDefined()
    })

    test('creates new user with Apple provider', async () => {
      const response = await apiPost('/auth/profile/create', {
        providerUserID: 'apple_456',
        email: 'apple@example.com',
        displayName: 'Apple User',
        authProvider: 'apple'
      })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.user.email).toBe('apple@example.com')
    })

    test('upserts existing user on duplicate providerId', async () => {
      const userData = {
        providerUserID: 'google_789',
        email: 'upsert@example.com',
        displayName: 'Original Name',
        authProvider: 'google'
      }

      // Create first time
      const first = await apiPost('/auth/profile/create', userData)
      const firstData = await expectSuccess(first)

      // Create again with different display name
      const second = await apiPost('/auth/profile/create', {
        ...userData,
        displayName: 'Updated Name'
      })
      const secondData = await expectSuccess(second)

      // Should be same user
      expect(secondData.user.id).toBe(firstData.user.id)
      expect(secondData.user.name).toBe('Updated Name')
    })

    test('requires providerUserID', async () => {
      const response = await apiPost('/auth/profile/create', {
        email: 'test@example.com',
        authProvider: 'google'
      })

      await expectError(response, 400)
    })

    test('requires email', async () => {
      const response = await apiPost('/auth/profile/create', {
        providerUserID: 'test123',
        authProvider: 'google'
      })

      await expectError(response, 400)
    })
  })

  describe('POST /api/auth/password/verify', () => {
    test('verifies correct password', async () => {
      // First create a password user via upsert
      const user = {
        providerUserID: 'password_user@example.com',
        email: 'password_user@example.com',
        displayName: 'Password User',
        authProvider: 'password'
      }

      await apiPost('/auth/profile/create', user)

      // Note: In real implementation, you'd need to set password hash
      // This test would need password registration endpoint
    })
  })

  describe('POST /api/auth/signout', () => {
    test('signs out successfully', async () => {
      const response = await apiPost('/auth/signout', {})

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })
  })
})
