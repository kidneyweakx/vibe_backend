import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { cleanDatabase, closeDatabase, createTestUser } from '../helpers/db'
import { uploadProfilePicture } from '../../src/services/user/profilePicture'
import getPrisma from '../../src/dbConfig'

describe('Profile Picture Service', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeDatabase()
  })

  describe('uploadProfilePicture', () => {
    test('uploads profile picture for existing user', async () => {
      const user = await createTestUser({
        email: 'profile@example.com',
        name: 'Profile User'
      })

      // Create a small test image file (1x1 PNG)
      const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const file = new File([bytes], 'profile.png', { type: 'image/png' })

      const result = await uploadProfilePicture(user.id, file)

      expect(result.success).toBe(true)
      expect(result.data?.photoId).toBeDefined()
      expect(result.data?.avatarUrl).toBeDefined()
      expect(result.data?.urls.original).toBeDefined()

      // Verify user avatar was updated
      const updatedUser = await getPrisma().user.findUnique({
        where: { id: user.id }
      })
      expect(updatedUser?.avatar).toBeDefined()
      expect(updatedUser?.avatar).toContain('profile-pictures/')
    })

    test('creates photo record with isProfilePicture flag', async () => {
      const user = await createTestUser({
        email: 'flag@example.com'
      })

      const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const file = new File([bytes], 'profile.png', { type: 'image/png' })

      const result = await uploadProfilePicture(user.id, file)

      expect(result.success).toBe(true)

      // Verify photo has isProfilePicture flag
      const photo = await getPrisma().photo.findUnique({
        where: { id: result.data!.photoId }
      })
      expect(photo?.isProfilePicture).toBe(true)
    })

    test('replaces old profile picture', async () => {
      const user = await createTestUser({
        email: 'replace@example.com'
      })

      const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const file1 = new File([bytes], 'profile1.png', { type: 'image/png' })
      const file2 = new File([bytes], 'profile2.png', { type: 'image/png' })

      // Upload first profile picture
      const result1 = await uploadProfilePicture(user.id, file1)
      expect(result1.success).toBe(true)

      // Upload second profile picture
      const result2 = await uploadProfilePicture(user.id, file2)
      expect(result2.success).toBe(true)

      // Verify only one profile picture exists
      const profilePictures = await getPrisma().photo.findMany({
        where: {
          userId: user.id,
          isProfilePicture: true
        }
      })
      expect(profilePictures.length).toBe(1)
      expect(profilePictures[0].id).toBe(result2.data!.photoId)
    })

    test('handles guest user upload', async () => {
      const guestId = 'guest_12345'

      const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const file = new File([bytes], 'guest-profile.png', { type: 'image/png' })

      const result = await uploadProfilePicture(guestId, file)

      expect(result.success).toBe(true)

      // Verify guest user was created
      const guestUser = await getPrisma().user.findUnique({
        where: { id: guestId }
      })
      expect(guestUser).toBeDefined()
      expect(guestUser?.email).toBe(`${guestId}@guest.local`)
    })

    test('rejects non-existent regular user', async () => {
      const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const file = new File([bytes], 'profile.png', { type: 'image/png' })

      const result = await uploadProfilePicture('non-existent-user', file)

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })
})
