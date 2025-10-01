import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { getTestDb, cleanDatabase, closeDatabase, createTestUser, createTestPhoto } from '../helpers/db'
import { getAllTags, createTag, addTagsToPhoto, getPhotoTags, getPhotosByTags } from '../../src/services/tag'

describe('Tag Service', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeDatabase()
  })

  describe('createTag and getAllTags', () => {
    test('creates and retrieves tags', async () => {
      const db = await getTestDb()

      const tag1 = await createTag(db, {
        name: 'casual',
        displayName: '休閒',
        emoji: '👕',
        color: '#3498DB',
        category: 'style'
      })

      const tag2 = await createTag(db, {
        name: 'formal',
        displayName: '正式',
        emoji: '👔',
        color: '#2C3E50',
        category: 'style'
      })

      expect(tag1.id).toBeDefined()
      expect(tag1.name).toBe('casual')
      expect(tag2.name).toBe('formal')

      const allTags = await getAllTags(db)
      expect(allTags.length).toBe(2)
      expect(allTags.map(t => t.name).sort()).toEqual(['casual', 'formal'])
    })

    test('enforces unique tag names', async () => {
      const db = await getTestDb()

      await createTag(db, {
        name: 'unique',
        displayName: 'Unique Tag'
      })

      // Should throw on duplicate name
      await expect(
        createTag(db, {
          name: 'unique',
          displayName: 'Another Display Name'
        })
      ).rejects.toThrow()
    })
  })

  describe('addTagsToPhoto and getPhotoTags', () => {
    test('adds and retrieves photo tags', async () => {
      const db = await getTestDb()

      const user = await createTestUser({
        email: 'tag-test@example.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/tagged.jpg'
      })

      const tag1 = await createTag(db, {
        name: 'summer',
        displayName: '夏天'
      })

      const tag2 = await createTag(db, {
        name: 'beach',
        displayName: '海灘'
      })

      // Add tags to photo
      await addTagsToPhoto(db, photo.id, [tag1.id, tag2.id])

      const photoTags = await getPhotoTags(db, photo.id)

      expect(photoTags.length).toBe(2)
      expect(photoTags.map(pt => pt.tag.name).sort()).toEqual(['beach', 'summer'])
    })

    test('prevents duplicate photo-tag associations', async () => {
      const db = await getTestDb()

      const user = await createTestUser({
        email: 'dup-test@example.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/dup.jpg'
      })

      const tag = await createTag(db, {
        name: 'test',
        displayName: 'Test'
      })

      await addTagsToPhoto(db, photo.id, [tag.id])

      // Adding same tag again should not error but also not duplicate
      await addTagsToPhoto(db, photo.id, [tag.id])

      const photoTags = await getPhotoTags(db, photo.id)
      expect(photoTags.length).toBe(1)
    })
  })

  describe('getPhotosByTags', () => {
    test.skip('finds photos with all specified tags', async () => {
      const db = await getTestDb()

      const user = await createTestUser({
        email: 'search-test@example.com'
      })

      const photo1 = await createTestPhoto({
        userId: user.id,
        key: 'test/photo1.jpg'
      })

      const photo2 = await createTestPhoto({
        userId: user.id,
        key: 'test/photo2.jpg'
      })

      const tagA = await createTag(db, { name: 'tagA', displayName: 'Tag A' })
      const tagB = await createTag(db, { name: 'tagB', displayName: 'Tag B' })

      // photo1 has both tags
      await addTagsToPhoto(db, photo1.id, [tagA.id, tagB.id])

      // photo2 has only tagA
      await addTagsToPhoto(db, photo2.id, [tagA.id])

      // Search for both tags
      const results = await getPhotosByTags(db, [tagA.id, tagB.id], 10, 0)

      // Should only return photo1
      expect(results.length).toBe(1)
      expect(results[0].id).toBe(photo1.id)
    })

    test.skip('respects limit and offset', async () => {
      const db = await getTestDb()

      const user = await createTestUser({
        email: 'pagination@example.com'
      })

      const tag = await createTag(db, { name: 'common', displayName: 'Common' })

      // Create 5 photos with the same tag
      for (let i = 0; i < 5; i++) {
        const photo = await createTestPhoto({
          userId: user.id,
          key: `test/photo${i}.jpg`
        })
        await addTagsToPhoto(db, photo.id, [tag.id])
      }

      const page1 = await getPhotosByTags(db, [tag.id], 2, 0)
      const page2 = await getPhotosByTags(db, [tag.id], 2, 2)

      expect(page1.length).toBe(2)
      expect(page2.length).toBe(2)
      expect(page1[0].id).not.toBe(page2[0].id)
    })
  })
})
