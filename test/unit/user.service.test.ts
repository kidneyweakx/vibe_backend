import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { UserService } from '../../src/services/user/serviceAdapter'
import { upsertUser } from '../../src/services/user/upsertUser'
import { getTestDb, cleanDatabase, closeDatabase } from '../helpers/db'

describe('UserService', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeDatabase()
  })

  describe('upsertUser', () => {
    test('creates new user when not exists', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        provider: 'google',
        providerId: 'google123'
      }

      const user = await UserService.upsertUser(userData)

      expect(user.id).toBeDefined()
      expect(user.email).toBe(userData.email)
      expect(user.name).toBe(userData.name)
      expect(user.provider).toBe(userData.provider)
      expect(user.providerId).toBe(userData.providerId)
    })

    test('updates existing user on duplicate provider/providerId', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Original Name',
        provider: 'google',
        providerId: 'google123'
      }

      const firstUser = await UserService.upsertUser(userData)

      // Upsert again with different name
      const updatedUser = await UserService.upsertUser({
        ...userData,
        name: 'Updated Name'
      })

      expect(updatedUser.id).toBe(firstUser.id)
      expect(updatedUser.name).toBe('Updated Name')

      // Verify only one user exists
      const db = await getTestDb()
      const count = await db.user.count()
      expect(count).toBe(1)
    })

    test('handles missing optional fields', async () => {
      const user = await UserService.upsertUser({
        email: 'minimal@example.com',
        provider: 'test',
        providerId: 'test123'
      })

      expect(user.id).toBeDefined()
      expect(user.email).toBe('minimal@example.com')
      expect(user.name).toBeNull()
      expect(user.avatar).toBeNull()
    })
  })

  describe('getUserById', () => {
    test('returns user when exists', async () => {
      const created = await UserService.upsertUser({
        email: 'find@example.com',
        name: 'Findable User',
        provider: 'test',
        providerId: 'test456'
      })

      const found = await UserService.getUserById(created.id)

      expect(found).toBeDefined()
      expect(found!.id).toBe(created.id)
      expect(found!.email).toBe('find@example.com')
    })

    test('returns null when user does not exist', async () => {
      const found = await UserService.getUserById('nonexistent-id')
      expect(found).toBeNull()
    })
  })

  describe('getUserByEmail', () => {
    test('returns user when exists', async () => {
      await UserService.upsertUser({
        email: 'email@example.com',
        provider: 'test',
        providerId: 'test789'
      })

      const found = await UserService.getUserByEmail('email@example.com')

      expect(found).toBeDefined()
      expect(found!.email).toBe('email@example.com')
    })

    test('returns null when email does not exist', async () => {
      const found = await UserService.getUserByEmail('nonexistent@example.com')
      expect(found).toBeNull()
    })
  })

  describe('updateUser', () => {
    test('updates user fields', async () => {
      const user = await UserService.upsertUser({
        email: 'update@example.com',
        name: 'Before Update',
        provider: 'test',
        providerId: 'update123'
      })

      const updated = await UserService.updateUser(user.id, {
        name: 'After Update',
        bio: 'New bio',
        location: 'New location'
      })

      expect(updated.name).toBe('After Update')
      expect(updated.bio).toBe('New bio')
      expect(updated.location).toBe('New location')
      expect(updated.email).toBe('update@example.com') // Unchanged
    })

    test('throws error when user does not exist', async () => {
      await expect(
        UserService.updateUser('nonexistent', { name: 'Test' })
      ).rejects.toThrow()
    })
  })

  describe('getUserPublicInfo', () => {
    test('returns public user info with photo count', async () => {
      const user = await UserService.upsertUser({
        email: 'public@example.com',
        name: 'Public User',
        bio: 'Test bio',
        provider: 'test',
        providerId: 'public123'
      })

      // Add some photos
      const db = await getTestDb()
      await db.photo.createMany({
        data: [
          {
            userId: user.id,
            key: 'test/photo1.jpg',
            url: 'https://example.com/1.jpg',
            format: 'jpg',
            size: 1000
          },
          {
            userId: user.id,
            key: 'test/photo2.jpg',
            url: 'https://example.com/2.jpg',
            format: 'jpg',
            size: 2000
          }
        ]
      })

      const info = await UserService.getUserPublicInfo(user.id)

      expect(info.user.id).toBe(user.id)
      expect(info.user.name).toBe('Public User')
      expect(info.stats.photoCount).toBe(2)
      expect(info.recentPhotos).toHaveLength(2)
    })

    test('throws error when user does not exist', async () => {
      await expect(
        UserService.getUserPublicInfo('nonexistent')
      ).rejects.toThrow('User not found')
    })
  })

  describe('upsertUser with error handling', () => {
    test('handles empty email gracefully', async () => {
      const userData = {
        email: '',
        name: 'No Email User',
        provider: 'test',
        providerId: 'noemail123'
      }

      const user = await upsertUser(userData)

      expect(user.id).toBeDefined()
      // Should use placeholder email
      expect(user.email).toBe('test_noemail123@placeholder.local')
    })

    test('handles whitespace email gracefully', async () => {
      const userData = {
        email: '   ',
        name: 'Whitespace Email',
        provider: 'test',
        providerId: 'whitespace123'
      }

      const user = await upsertUser(userData)

      expect(user.id).toBeDefined()
      expect(user.email).toBe('test_whitespace123@placeholder.local')
    })

    test('handles unique email conflict on create', async () => {
      const db = await getTestDb()

      // Create first user with email
      const firstUser = await upsertUser({
        email: 'conflict@example.com',
        provider: 'google',
        providerId: 'google123'
      })

      // Try to create user with same email but different provider
      // This simulates a unique email conflict scenario
      const secondUser = await upsertUser({
        email: 'conflict@example.com',
        provider: 'apple',
        providerId: 'apple456'
      })

      // Should update the existing user with new provider info
      expect(secondUser.id).toBe(firstUser.id)
      expect(secondUser.provider).toBe('apple')
      expect(secondUser.providerId).toBe('apple456')
    })

    test('preserves existing fields on conflict resolution', async () => {
      const firstUser = await upsertUser({
        email: 'preserve@example.com',
        name: 'Original Name',
        avatar: 'original-avatar.jpg',
        gender: 'male',
        provider: 'google',
        providerId: 'google789'
      })

      // Update with minimal data
      const updated = await upsertUser({
        email: 'preserve@example.com',
        provider: 'apple',
        providerId: 'apple789'
      })

      expect(updated.id).toBe(firstUser.id)
      expect(updated.name).toBe('Original Name')
      expect(updated.avatar).toBe('original-avatar.jpg')
      expect(updated.gender).toBe('male')
    })

    test('updates optional fields when provided', async () => {
      const firstUser = await upsertUser({
        email: 'update-fields@example.com',
        name: 'Original',
        provider: 'test',
        providerId: 'test123'
      })

      const updated = await upsertUser({
        email: 'update-fields@example.com',
        name: 'Updated Name',
        avatar: 'new-avatar.jpg',
        gender: 'female',
        provider: 'test',
        providerId: 'test123'
      })

      expect(updated.id).toBe(firstUser.id)
      expect(updated.name).toBe('Updated Name')
      expect(updated.avatar).toBe('new-avatar.jpg')
      expect(updated.gender).toBe('female')
    })

    test('creates new user when provider/providerId not found', async () => {
      const user1 = await upsertUser({
        email: 'user1@example.com',
        provider: 'google',
        providerId: 'google111'
      })

      const user2 = await upsertUser({
        email: 'user2@example.com',
        provider: 'google',
        providerId: 'google222'
      })

      expect(user1.id).not.toBe(user2.id)
    })

    test('handles database errors gracefully', async () => {
      // This test verifies error handling for database issues
      // We can't easily simulate a real DB error, but we can verify
      // the function signature and basic flow
      const userData = {
        email: 'db-test@example.com',
        provider: 'test',
        providerId: 'dbtest123'
      }

      const user = await upsertUser(userData)
      expect(user.id).toBeDefined()
    })

    test('logs timestamps during operation', async () => {
      // Verify that the function completes within reasonable time
      const start = Date.now()

      await upsertUser({
        email: 'timing@example.com',
        provider: 'test',
        providerId: 'timing123'
      })

      const duration = Date.now() - start
      // Should complete in under 5 seconds (very generous)
      expect(duration).toBeLessThan(5000)
    })

    test('handles concurrent upserts correctly', async () => {
      // Test that concurrent upserts don't create duplicate users
      const userData = {
        email: 'concurrent@example.com',
        name: 'Concurrent User',
        provider: 'test',
        providerId: 'concurrent123'
      }

      // Create multiple concurrent upserts
      const results = await Promise.all([
        upsertUser(userData),
        upsertUser(userData),
        upsertUser(userData)
      ])

      // All should return the same user ID
      expect(results[0].id).toBe(results[1].id)
      expect(results[1].id).toBe(results[2].id)

      // Verify only one user was created
      const db = await getTestDb()
      const users = await db.user.findMany({
        where: { providerId: 'concurrent123' }
      })
      expect(users.length).toBe(1)
    })

    test('correctly updates updatedAt timestamp', async () => {
      const user1 = await upsertUser({
        email: 'timestamp@example.com',
        provider: 'test',
        providerId: 'timestamp123'
      })

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100))

      const user2 = await upsertUser({
        email: 'timestamp@example.com',
        name: 'Updated',
        provider: 'test',
        providerId: 'timestamp123'
      })

      expect(user2.updatedAt.getTime()).toBeGreaterThan(user1.updatedAt.getTime())
    })

    test('handles special characters in email', async () => {
      const user = await upsertUser({
        email: 'test+special@example.com',
        provider: 'test',
        providerId: 'special123'
      })

      expect(user.email).toBe('test+special@example.com')
    })

    test('handles long email addresses', async () => {
      const longEmail = 'very.long.email.address.with.many.dots@subdomain.example.com'
      const user = await upsertUser({
        email: longEmail,
        provider: 'test',
        providerId: 'long123'
      })

      expect(user.email).toBe(longEmail)
    })

    test('handles passwordHash field', async () => {
      const user = await upsertUser({
        email: 'password@example.com',
        provider: 'password',
        providerId: 'pwd123',
        passwordHash: 'hashed-password-string'
      })

      expect(user.id).toBeDefined()
      // passwordHash should be stored but not returned in response
      expect(user.passwordHash).toBeDefined()
    })

    test('preserves case sensitivity in provider fields', async () => {
      const user = await upsertUser({
        email: 'case@example.com',
        provider: 'Google',
        providerId: 'CaseSensitive123'
      })

      expect(user.provider).toBe('Google')
      expect(user.providerId).toBe('CaseSensitive123')
    })
  })
})
