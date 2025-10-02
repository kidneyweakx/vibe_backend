import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { cleanDatabase, closeDatabase, createTestUser, createTestPhoto, createTestTag, createAuthenticatedTestUser } from '../helpers/db'
import { apiGet, apiPost, expectSuccess, expectError } from '../helpers/api'

describe('Tag E2E', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeDatabase()
  })

  describe('GET /api/tag/', () => {
    test('returns all tags', async () => {
      // Create some test tags
      await createTestTag({ name: 'nature', displayName: 'Nature' })
      await createTestTag({ name: 'city', displayName: 'City' })
      await createTestTag({ name: 'food', displayName: 'Food' })

      const response = await apiGet('/tags/')
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(3)
      expect(data.data[0].name).toBeDefined()
      expect(data.data[0].displayName).toBeDefined()
    })

    test('returns empty array when no tags exist', async () => {
      const response = await apiGet('/tags/')
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(0)
    })

    test('filters tags by category', async () => {
      // Create tags with different categories
      const db = await import('../../src/dbConfig').then(m => m.default())
      await db.tag.create({
        data: {
          name: 'beach',
          displayName: 'Beach',
          emoji: '🏖️',
          color: '#000000',
          category: 'outdoor'
        }
      })
      await db.tag.create({
        data: {
          name: 'restaurant',
          displayName: 'Restaurant',
          emoji: '🍽️',
          color: '#000000',
          category: 'indoor'
        }
      })

      const response = await apiGet('/tags/?category=outdoor')
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(1)
      expect(data.data[0].category).toBe('outdoor')
    })
  })

  describe('POST /api/tag/', () => {
    test('creates new tag with all fields', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'tag-creator@example.com',
        name: 'Tag Creator'
      })

      const response = await apiPost('/tags/', {
        name: 'sunset',
        displayName: 'Sunset',
        emoji: '🌅',
        color: '#FF6B35',
        category: 'nature'
      }, { token })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.name).toBe('sunset')
      expect(data.data.displayName).toBe('Sunset')
      expect(data.data.emoji).toBe('🌅')
      expect(data.data.color).toBe('#FF6B35')
    })

    test('creates tag with minimal fields', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'tag-minimal@example.com'
      })

      const response = await apiPost('/tags/', {
        name: 'minimal',
        displayName: 'Minimal Tag'
      }, { token })

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.name).toBe('minimal')
      expect(data.data.displayName).toBe('Minimal Tag')
    })

    test('requires authentication', async () => {
      const response = await apiPost('/tags/', {
        name: 'no-auth',
        displayName: 'No Auth Tag'
      })

      await expectError(response, 401)
    })

    test('requires name field', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'tag-no-name@example.com'
      })

      const response = await apiPost('/tags/', {
        displayName: 'No Name Tag'
      }, { token })

      await expectError(response, 422)
    })

    test('requires displayName field', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'tag-no-display@example.com'
      })

      const response = await apiPost('/tags/', {
        name: 'no-display'
      }, { token })

      await expectError(response, 422)
    })

    test('validates color format', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'tag-invalid-color@example.com'
      })

      const response = await apiPost('/tags/', {
        name: 'invalid-color',
        displayName: 'Invalid Color',
        color: 'not-a-color'
      }, { token })

      await expectError(response, 422)
    })

    test('accepts valid hex color', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'tag-valid-color@example.com'
      })

      const response = await apiPost('/tags/', {
        name: 'valid-color',
        displayName: 'Valid Color',
        color: '#ABCDEF'
      }, { token })

      const data = await expectSuccess(response)
      expect(data.success).toBe(true)
      expect(data.data.color).toBe('#ABCDEF')
    })
  })

  describe('GET /api/tag/photos/:photoId', () => {
    test('returns tags for photo', async () => {
      const user = await createTestUser({
        email: 'photo-tags@example.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/tagged-photo.jpg'
      })

      const tag1 = await createTestTag({ name: 'tag1', displayName: 'Tag 1' })
      const tag2 = await createTestTag({ name: 'tag2', displayName: 'Tag 2' })

      // Add tags to photo
      const db = await import('../../src/dbConfig').then(m => m.default())
      await db.photoTag.createMany({
        data: [
          { photoId: photo.id, tagId: tag1.id },
          { photoId: photo.id, tagId: tag2.id }
        ]
      })

      const response = await apiGet(`/tag/photos/${photo.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(2)
      expect(data.data.map((t: any) => t.name).sort()).toEqual(['tag1', 'tag2'])
    })

    test('returns empty array for photo with no tags', async () => {
      const user = await createTestUser({
        email: 'no-tags@example.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/no-tags.jpg'
      })

      const response = await apiGet(`/tag/photos/${photo.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(0)
    })
  })

  describe('POST /api/tag/photos/:photoId', () => {
    test('adds tags to own photo (requireAuth)', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'add-tags@example.com',
        name: 'Tag Adder'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/add-tags.jpg'
      })

      const tag1 = await createTestTag({ name: 'addtag1', displayName: 'Add Tag 1' })
      const tag2 = await createTestTag({ name: 'addtag2', displayName: 'Add Tag 2' })

      const response = await apiPost(
        `/tag/photos/${photo.id}`,
        {
          tagIds: [tag1.id, tag2.id]
        },
        { token }
      )

      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(2)
    })

    test('requires authentication', async () => {
      const user = await createTestUser({
        email: 'no-auth-tags@example.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/no-auth-tags.jpg'
      })

      const tag = await createTestTag({ name: 'tag1', displayName: 'Tag 1' })

      const response = await apiPost(
        `/tag/photos/${photo.id}`,
        {
          tagIds: [tag.id]
        }
      )

      await expectError(response, 401)
    })

    test('requires tagIds array', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'no-tagids@example.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/no-tagids.jpg'
      })

      const response = await apiPost(
        `/tag/photos/${photo.id}`,
        {},
        { token }
      )

      await expectError(response, 422)
    })

    test('requires non-empty tagIds array', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'empty-tagids@example.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/empty-tagids.jpg'
      })

      const response = await apiPost(
        `/tag/photos/${photo.id}`,
        {
          tagIds: []
        },
        { token }
      )

      await expectError(response, 422)
    })
  })

  describe('GET /api/tags/search', () => {
    test('searches photos by single tag', async () => {
      const user = await createTestUser({
        email: 'search@example.com'
      })

      const photo1 = await createTestPhoto({
        userId: user.id,
        key: 'test/search1.jpg'
      })

      const photo2 = await createTestPhoto({
        userId: user.id,
        key: 'test/search2.jpg'
      })

      const tag = await createTestTag({ name: 'search-tag', displayName: 'Search Tag' })

      // Add tag to photos
      const db = await import('../../src/dbConfig').then(m => m.default())
      await db.photoTag.createMany({
        data: [
          { photoId: photo1.id, tagId: tag.id },
          { photoId: photo2.id, tagId: tag.id }
        ]
      })

      const response = await apiGet(`/tags/search?tagIds[]=${tag.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(2)
    })

    test('searches photos by multiple tags', async () => {
      const user = await createTestUser({
        email: 'search-multi@example.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/multi-tag.jpg'
      })

      const tag1 = await createTestTag({ name: 'tag-a', displayName: 'Tag A' })
      const tag2 = await createTestTag({ name: 'tag-b', displayName: 'Tag B' })

      // Add both tags to photo
      const db = await import('../../src/dbConfig').then(m => m.default())
      await db.photoTag.createMany({
        data: [
          { photoId: photo.id, tagId: tag1.id },
          { photoId: photo.id, tagId: tag2.id }
        ]
      })

      const response = await apiGet(`/tags/search?tagIds[]=${tag1.id}&tagIds[]=${tag2.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBeGreaterThanOrEqual(1)
    })

    test('supports limit parameter', async () => {
      const user = await createTestUser({
        email: 'search-limit@example.com'
      })

      const tag = await createTestTag({ name: 'limit-tag', displayName: 'Limit Tag' })

      // Create multiple photos with same tag
      for (let i = 1; i <= 5; i++) {
        const photo = await createTestPhoto({
          userId: user.id,
          key: `test/limit${i}.jpg`
        })

        const db = await import('../../src/dbConfig').then(m => m.default())
        await db.photoTag.create({
          data: { photoId: photo.id, tagId: tag.id }
        })
      }

      const response = await apiGet(`/tags/search?tagIds[]=${tag.id}&limit=3`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(3)
    })

    test('supports offset parameter', async () => {
      const user = await createTestUser({
        email: 'search-offset@example.com'
      })

      const tag = await createTestTag({ name: 'offset-tag', displayName: 'Offset Tag' })

      // Create multiple photos
      for (let i = 1; i <= 5; i++) {
        const photo = await createTestPhoto({
          userId: user.id,
          key: `test/offset${i}.jpg`
        })

        const db = await import('../../src/dbConfig').then(m => m.default())
        await db.photoTag.create({
          data: { photoId: photo.id, tagId: tag.id }
        })
      }

      const response = await apiGet(`/tags/search?tagIds[]=${tag.id}&offset=2&limit=3`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(3)
    })

    test('requires at least one tagId', async () => {
      const response = await apiGet('/tags/search')
      await expectError(response, 422)
    })

    test('returns empty array when no photos match', async () => {
      const tag = await createTestTag({ name: 'no-match', displayName: 'No Match' })

      const response = await apiGet(`/tags/search?tagIds[]=${tag.id}`)
      const data = await expectSuccess(response)

      expect(data.success).toBe(true)
      expect(data.data.length).toBe(0)
    })
  })
})
