import { describe, it, expect, beforeEach } from 'bun:test'
import { TagService } from '../src/routes/tag/service'
import { testPrisma, testTags, testPhotos, cleanupTestData, setupTestData } from './setup'

describe('TagService', () => {
  let tagService: TagService

  beforeEach(async () => {
    await cleanupTestData()
    await setupTestData()
    tagService = new TagService(testPrisma)
  })

  describe('getAllTags', () => {
    it('should return all tags', async () => {
      const tags = await tagService.getAllTags()
      
      expect(tags).toHaveLength(3)
      expect(tags[0]).toMatchObject({
        name: expect.any(String),
        displayName: expect.any(String),
        category: 'style'
      })
    })
  })

  describe('getTagsByCategory', () => {
    it('should return tags filtered by category', async () => {
      const tags = await tagService.getTagsByCategory('style')
      
      expect(tags).toHaveLength(3)
      tags.forEach(tag => {
        expect(tag.category).toBe('style')
      })
    })

    it('should return empty array for non-existent category', async () => {
      const tags = await tagService.getTagsByCategory('non-existent')
      
      expect(tags).toHaveLength(0)
    })
  })

  describe('addTagsToPhoto', () => {
    it('should add tags to photo', async () => {
      const photoId = testPhotos[0].id
      const tagIds = [testTags[0].id, testTags[1].id]
      
      await tagService.addTagsToPhoto(photoId, tagIds)
      
      const photoTags = await testPrisma.photoTag.findMany({
        where: { photoId }
      })
      
      expect(photoTags).toHaveLength(2)
      expect(photoTags.map(pt => pt.tagId)).toEqual(expect.arrayContaining(tagIds))
    })

    it('should replace existing tags when adding new ones', async () => {
      const photoId = testPhotos[0].id
      
      // 先添加一個標籤
      await tagService.addTagsToPhoto(photoId, [testTags[0].id])
      
      let photoTags = await testPrisma.photoTag.findMany({
        where: { photoId }
      })
      expect(photoTags).toHaveLength(1)
      
      // 再添加不同的標籤，應該替換原有的
      await tagService.addTagsToPhoto(photoId, [testTags[1].id, testTags[2].id])
      
      photoTags = await testPrisma.photoTag.findMany({
        where: { photoId }
      })
      expect(photoTags).toHaveLength(2)
      expect(photoTags.map(pt => pt.tagId)).toEqual(
        expect.arrayContaining([testTags[1].id, testTags[2].id])
      )
    })
  })

  describe('getPhotoTags', () => {
    it('should return tags for a photo', async () => {
      const photoId = testPhotos[0].id
      const tagIds = [testTags[0].id, testTags[1].id]
      
      await tagService.addTagsToPhoto(photoId, tagIds)
      
      const photoTags = await tagService.getPhotoTags(photoId)
      
      expect(photoTags).toHaveLength(2)
      expect(photoTags[0]).toHaveProperty('tag')
      expect(photoTags[0].tag).toMatchObject({
        name: expect.any(String),
        displayName: expect.any(String)
      })
    })

    it('should return empty array for photo with no tags', async () => {
      const photoId = testPhotos[0].id
      
      const photoTags = await tagService.getPhotoTags(photoId)
      
      expect(photoTags).toHaveLength(0)
    })
  })

  describe('getPhotosByTags', () => {
    it('should return photos with specified tags', async () => {
      const photoId = testPhotos[0].id
      const tagIds = [testTags[0].id]
      
      await tagService.addTagsToPhoto(photoId, tagIds)
      
      const photos = await tagService.getPhotosByTags(tagIds)
      
      expect(photos).toHaveLength(1)
      expect(photos[0].id).toBe(photoId)
      expect(photos[0]).toHaveProperty('user')
      expect(photos[0]).toHaveProperty('photoTags')
      expect(photos[0]).toHaveProperty('_count')
    })

    it('should return photos matching any of the specified tags', async () => {
      // 為不同照片添加不同標籤
      await tagService.addTagsToPhoto(testPhotos[0].id, [testTags[0].id])
      await tagService.addTagsToPhoto(testPhotos[1].id, [testTags[1].id])
      
      const photos = await tagService.getPhotosByTags([testTags[0].id, testTags[1].id])
      
      expect(photos).toHaveLength(2)
    })

    it('should respect limit and offset parameters', async () => {
      // 為多張照片添加相同標籤
      await tagService.addTagsToPhoto(testPhotos[0].id, [testTags[0].id])
      await tagService.addTagsToPhoto(testPhotos[1].id, [testTags[0].id])
      await tagService.addTagsToPhoto(testPhotos[2].id, [testTags[0].id])
      
      const photos = await tagService.getPhotosByTags([testTags[0].id], 2, 1)
      
      expect(photos).toHaveLength(2)
    })
  })

  describe('getPopularTags', () => {
    it('should return tags ordered by usage count', async () => {
      // 為標籤添加不同的使用次數
      await tagService.addTagsToPhoto(testPhotos[0].id, [testTags[0].id]) // tag 0: 1次
      await tagService.addTagsToPhoto(testPhotos[1].id, [testTags[0].id, testTags[1].id]) // tag 0: 2次, tag 1: 1次
      await tagService.addTagsToPhoto(testPhotos[2].id, [testTags[1].id]) // tag 1: 2次
      
      const popularTags = await tagService.getPopularTags()
      
      expect(popularTags).toHaveLength(2) // 只返回有使用的標籤
      expect(popularTags[0]._count.photoTags).toBeGreaterThanOrEqual(popularTags[1]._count.photoTags)
    })

    it('should respect limit parameter', async () => {
      await tagService.addTagsToPhoto(testPhotos[0].id, [testTags[0].id, testTags[1].id])
      
      const popularTags = await tagService.getPopularTags(1)
      
      expect(popularTags).toHaveLength(1)
    })

    it('should return empty array when no tags are used', async () => {
      const popularTags = await tagService.getPopularTags()
      
      expect(popularTags).toHaveLength(0)
    })
  })

  describe('createTag', () => {
    it('should create a new tag', async () => {
      const newTagData = {
        name: 'casual',
        displayName: '休閒風',
        emoji: '👕',
        color: '#3498DB',
        category: 'style'
      }
      
      const createdTag = await tagService.createTag(newTagData)
      
      expect(createdTag).toMatchObject(newTagData)
      expect(createdTag.id).toBeDefined()
      expect(createdTag.createdAt).toBeDefined()
    })

    it('should create tag with minimal required fields', async () => {
      const newTagData = {
        name: 'minimal',
        displayName: '極簡'
      }
      
      const createdTag = await tagService.createTag(newTagData)
      
      expect(createdTag.name).toBe('minimal')
      expect(createdTag.displayName).toBe('極簡')
      expect(createdTag.emoji).toBeNull()
      expect(createdTag.color).toBeNull()
      expect(createdTag.category).toBeNull()
    })
  })

  describe('updateTag', () => {
    it('should update tag properties', async () => {
      const tagId = testTags[0].id
      const updateData = {
        displayName: '更新的運動風',
        emoji: '🏃',
        color: '#FF0000'
      }
      
      const updatedTag = await tagService.updateTag(tagId, updateData)
      
      expect(updatedTag.displayName).toBe('更新的運動風')
      expect(updatedTag.emoji).toBe('🏃')
      expect(updatedTag.color).toBe('#FF0000')
      expect(updatedTag.name).toBe(testTags[0].name) // 名稱不應該改變
    })
  })

  describe('deleteTag', () => {
    it('should delete tag and its associations', async () => {
      const tagId = testTags[0].id
      const photoId = testPhotos[0].id
      
      // 先為照片添加標籤
      await tagService.addTagsToPhoto(photoId, [tagId])
      
      // 確認關聯存在
      let photoTags = await testPrisma.photoTag.findMany({
        where: { tagId }
      })
      expect(photoTags).toHaveLength(1)
      
      // 刪除標籤
      await tagService.deleteTag(tagId)
      
      // 確認標籤已刪除
      const deletedTag = await testPrisma.tag.findUnique({
        where: { id: tagId }
      })
      expect(deletedTag).toBeNull()
      
      // 確認關聯也已刪除
      photoTags = await testPrisma.photoTag.findMany({
        where: { tagId }
      })
      expect(photoTags).toHaveLength(0)
    })
  })
})