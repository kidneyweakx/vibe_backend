import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { getTestDb, cleanDatabase, closeDatabase, createTestUser, createTestPhoto } from '../helpers/db'
import {
  getAllTags,
  createTag,
  addTagsToPhoto,
  getPhotoTags,
  getPhotosByTags,
  deleteTag,
  getPopularTags,
  updateTag,
  getTagsByCategory
} from '../../src/services/tag'

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

  describe('deleteTag', () => {
    test('deletes tag and associated photo tags', async () => {
      const db = await getTestDb()

      const user = await createTestUser({
        email: 'delete-tag@example.com'
      })

      const photo = await createTestPhoto({
        userId: user.id,
        key: 'test/delete-tag.jpg'
      })

      const tag = await createTag(db, {
        name: 'to-delete',
        displayName: 'To Delete'
      })

      // Add tag to photo
      await addTagsToPhoto(db, photo.id, [tag.id])

      // Verify tag is associated
      const photoTags = await getPhotoTags(db, photo.id)
      expect(photoTags.length).toBe(1)

      // Delete tag
      await deleteTag(db, tag.id)

      // Verify tag is deleted
      const tags = await getAllTags(db)
      expect(tags.length).toBe(0)

      // Verify photo tags are also deleted
      const photoTagsAfter = await getPhotoTags(db, photo.id)
      expect(photoTagsAfter.length).toBe(0)
    })
  })

  describe('getPopularTags', () => {
    test('returns tags ordered by usage count', async () => {
      const db = await getTestDb()

      const user = await createTestUser({
        email: 'popular-tags@example.com'
      })

      // Create tags
      const tag1 = await createTag(db, { name: 'popular', displayName: 'Popular' })
      const tag2 = await createTag(db, { name: 'less-popular', displayName: 'Less Popular' })
      const tag3 = await createTag(db, { name: 'unused', displayName: 'Unused' })

      // Create photos and tag them
      const photo1 = await createTestPhoto({ userId: user.id, key: 'test/p1.jpg' })
      const photo2 = await createTestPhoto({ userId: user.id, key: 'test/p2.jpg' })
      const photo3 = await createTestPhoto({ userId: user.id, key: 'test/p3.jpg' })

      // photo1 has tag1 and tag2
      await addTagsToPhoto(db, photo1.id, [tag1.id, tag2.id])

      // photo2 has tag1
      await addTagsToPhoto(db, photo2.id, [tag1.id])

      // photo3 has tag1
      await addTagsToPhoto(db, photo3.id, [tag1.id])

      // tag3 not used

      const popularTags = await getPopularTags(db)

      // Should only return tags with usage > 0
      expect(popularTags.length).toBe(2)
      expect(popularTags[0].name).toBe('popular')
      expect(popularTags[0]._count.photoTags).toBe(3)
      expect(popularTags[1].name).toBe('less-popular')
      expect(popularTags[1]._count.photoTags).toBe(1)
    })

    test('respects limit parameter', async () => {
      const db = await getTestDb()

      const user = await createTestUser({
        email: 'limit-tags@example.com'
      })

      // Create 5 tags and use them
      for (let i = 0; i < 5; i++) {
        const tag = await createTag(db, { name: `tag${i}`, displayName: `Tag ${i}` })
        const photo = await createTestPhoto({ userId: user.id, key: `test/p${i}.jpg` })
        await addTagsToPhoto(db, photo.id, [tag.id])
      }

      const popularTags = await getPopularTags(db, 3)
      expect(popularTags.length).toBe(3)
    })
  })

  describe('updateTag', () => {
    test('updates tag fields', async () => {
      const db = await getTestDb()

      const tag = await createTag(db, {
        name: 'original',
        displayName: 'Original',
        emoji: '🏷️',
        color: '#000000',
        category: 'old'
      })

      const updated = await updateTag(db, tag.id, {
        displayName: 'Updated',
        emoji: '✨',
        color: '#FFFFFF',
        category: 'new'
      })

      expect(updated.displayName).toBe('Updated')
      expect(updated.emoji).toBe('✨')
      expect(updated.color).toBe('#FFFFFF')
      expect(updated.category).toBe('new')
      expect(updated.name).toBe('original') // name shouldn't change
    })

    test('updates partial fields', async () => {
      const db = await getTestDb()

      const tag = await createTag(db, {
        name: 'partial',
        displayName: 'Partial',
        emoji: '🎯',
        color: '#123456'
      })

      const updated = await updateTag(db, tag.id, {
        displayName: 'New Display Name'
      })

      expect(updated.displayName).toBe('New Display Name')
      expect(updated.emoji).toBe('🎯') // unchanged
      expect(updated.color).toBe('#123456') // unchanged
    })
  })

  describe('getTagsByCategory', () => {
    test('returns tags filtered by category', async () => {
      const db = await getTestDb()

      await createTag(db, { name: 'casual', displayName: 'Casual', category: 'style' })
      await createTag(db, { name: 'formal', displayName: 'Formal', category: 'style' })
      await createTag(db, { name: 'beach', displayName: 'Beach', category: 'location' })
      await createTag(db, { name: 'city', displayName: 'City', category: 'location' })

      const styleTags = await getTagsByCategory(db, 'style')
      expect(styleTags.length).toBe(2)
      expect(styleTags.map(t => t.name).sort()).toEqual(['casual', 'formal'])

      const locationTags = await getTagsByCategory(db, 'location')
      expect(locationTags.length).toBe(2)
      expect(locationTags.map(t => t.name).sort()).toEqual(['beach', 'city'])
    })

    test('returns empty array for non-existent category', async () => {
      const db = await getTestDb()

      await createTag(db, { name: 'test', displayName: 'Test', category: 'other' })

      const tags = await getTagsByCategory(db, 'non-existent')
      expect(tags.length).toBe(0)
    })

    test('orders tags by displayName ascending', async () => {
      const db = await getTestDb()

      await createTag(db, { name: 'z-tag', displayName: 'Zebra', category: 'test' })
      await createTag(db, { name: 'a-tag', displayName: 'Apple', category: 'test' })
      await createTag(db, { name: 'm-tag', displayName: 'Mango', category: 'test' })

      const tags = await getTagsByCategory(db, 'test')
      expect(tags.map(t => t.displayName)).toEqual(['Apple', 'Mango', 'Zebra'])
    })
  })
})
