import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { UserService } from '../../src/services/user/serviceAdapter'
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
})
