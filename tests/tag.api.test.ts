import { describe, it, expect, beforeEach } from 'bun:test'
import { Elysia } from 'elysia'
import { tagModule } from '../src/routes/tag'
import { testPrisma, testTags, testPhotos, testUsers, cleanupTestData, setupTestData, mockAuthUser } from './setup'

describe('Tag API', () => {
  let app: Elysia

  beforeEach(async () => {
    await cleanupTestData()
    await setupTestData()
    
    // 創建測試應用
    app = new Elysia()
      .decorate('prisma', testPrisma)
      .use(tagModule)
  })

  describe('GET /tags', () => {
    it('should return all tags', async () => {
      const response = await app.handle(new Request('http://localhost/tags'))
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(3)
      expect(result.data[0]).toMatchObject({
        name: expect.any(String),
        displayName: expect.any(String),
        category: 'style'
      })
    })

    it('should filter tags by category', async () => {
      const response = await app.handle(new Request('http://localhost/tags?category=style'))
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(3)
      result.data.forEach((tag: any) => {
        expect(tag.category).toBe('style')
      })
    })
  })

  describe('GET /tags/popular', () => {
    it('should return popular tags', async () => {
      // 先為照片添加標籤來創建使用統計
      await testPrisma.photoTag.createMany({
        data: [
          { photoId: testPhotos[0].id, tagId: testTags[0].id },
          { photoId: testPhotos[1].id, tagId: testTags[0].id },
          { photoId: testPhotos[2].id, tagId: testTags[1].id }
        ]
      })
      
      const response = await app.handle(new Request('http://localhost/tags/popular'))
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
      expect(result.data[0]).toHaveProperty('_count')
      expect(result.data[0]._count.photoTags).toBeGreaterThan(0)
    })

    it('should respect limit parameter', async () => {
      await testPrisma.photoTag.createMany({
        data: [
          { photoId: testPhotos[0].id, tagId: testTags[0].id },
          { photoId: testPhotos[1].id, tagId: testTags[1].id }
        ]
      })
      
      const response = await app.handle(new Request('http://localhost/tags/popular?limit=1'))
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.data).toHaveLength(1)
    })
  })

  describe('POST /tags/photos/:photoId', () => {
    it('should add tags to photo for authenticated user', async () => {
      // Mock 認證中間件
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(tagModule)
      
      const requestBody = {
        tagIds: [testTags[0].id, testTags[1].id]
      }
      
      const response = await testApp.handle(
        new Request(`http://localhost/tags/photos/${testPhotos[0].id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
      )
      
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.message).toBe('標籤添加成功')
      
      // 驗證標籤已添加
      const photoTags = await testPrisma.photoTag.findMany({
        where: { photoId: testPhotos[0].id }
      })
      expect(photoTags).toHaveLength(2)
    })

    it('should return 404 for non-existent photo', async () => {
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(tagModule)
      
      const requestBody = {
        tagIds: [testTags[0].id]
      }
      
      const response = await testApp.handle(
        new Request('http://localhost/tags/photos/non-existent-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
      )
      
      const result = await response.json()
      
      expect(response.status).toBe(404)
      expect(result.success).toBe(false)
      expect(result.error).toBe('照片不存在或無權限')
    })

    it('should return 404 when user tries to tag another users photo', async () => {
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(tagModule)
      
      const requestBody = {
        tagIds: [testTags[0].id]
      }
      
      // 嘗試為 user2 的照片添加標籤
      const response = await testApp.handle(
        new Request(`http://localhost/tags/photos/${testPhotos[2].id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
      )
      
      const result = await response.json()
      
      expect(response.status).toBe(404)
      expect(result.success).toBe(false)
      expect(result.error).toBe('照片不存在或無權限')
    })
  })

  describe('GET /tags/photos/:photoId', () => {
    it('should return tags for a photo', async () => {
      // 先為照片添加標籤
      await testPrisma.photoTag.createMany({
        data: [
          { photoId: testPhotos[0].id, tagId: testTags[0].id },
          { photoId: testPhotos[0].id, tagId: testTags[1].id }
        ]
      })
      
      const response = await app.handle(
        new Request(`http://localhost/tags/photos/${testPhotos[0].id}`)
      )
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.data[0]).toMatchObject({
        name: expect.any(String),
        displayName: expect.any(String)
      })
    })

    it('should return empty array for photo with no tags', async () => {
      const response = await app.handle(
        new Request(`http://localhost/tags/photos/${testPhotos[0].id}`)
      )
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(0)
    })
  })

  describe('GET /tags/search', () => {
    it('should search photos by tags', async () => {
      // 為照片添加標籤
      await testPrisma.photoTag.createMany({
        data: [
          { photoId: testPhotos[0].id, tagId: testTags[0].id },
          { photoId: testPhotos[1].id, tagId: testTags[1].id }
        ]
      })
      
      const tagIds = [testTags[0].id, testTags[1].id]
      const queryParams = tagIds.map(id => `tagIds[]=${id}`).join('&')
      
      const response = await app.handle(
        new Request(`http://localhost/tags/search?${queryParams}`)
      )
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.data[0]).toHaveProperty('user')
      expect(result.data[0]).toHaveProperty('photoTags')
    })

    it('should return 400 when no tags provided', async () => {
      const response = await app.handle(
        new Request('http://localhost/tags/search')
      )
      const result = await response.json()
      
      expect(response.status).toBe(400)
      expect(result.success).toBe(false)
      expect(result.error).toBe('請選擇至少一個標籤')
    })

    it('should respect limit and offset parameters', async () => {
      // 為多張照片添加相同標籤
      await testPrisma.photoTag.createMany({
        data: [
          { photoId: testPhotos[0].id, tagId: testTags[0].id },
          { photoId: testPhotos[1].id, tagId: testTags[0].id },
          { photoId: testPhotos[2].id, tagId: testTags[0].id }
        ]
      })
      
      const response = await app.handle(
        new Request(`http://localhost/tags/search?tagIds[]=${testTags[0].id}&limit=2&offset=1`)
      )
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.data).toHaveLength(2)
    })
  })

  describe('POST /tags', () => {
    it('should create a new tag for authenticated user', async () => {
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(tagModule)
      
      const newTagData = {
        name: 'casual',
        displayName: '休閒風',
        emoji: '👕',
        color: '#3498DB',
        category: 'style'
      }
      
      const response = await testApp.handle(
        new Request('http://localhost/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTagData)
        })
      )
      
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data).toMatchObject(newTagData)
      expect(result.data.id).toBeDefined()
    })

    it('should validate required fields', async () => {
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(tagModule)
      
      const invalidTagData = {
        name: '', // 空名稱應該失敗
        displayName: '測試'
      }
      
      const response = await testApp.handle(
        new Request('http://localhost/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidTagData)
        })
      )
      
      expect(response.status).toBe(422) // Validation error
    })

    it('should validate color format', async () => {
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(tagModule)
      
      const invalidTagData = {
        name: 'test',
        displayName: '測試',
        color: 'invalid-color' // 無效的顏色格式
      }
      
      const response = await testApp.handle(
        new Request('http://localhost/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidTagData)
        })
      )
      
      expect(response.status).toBe(422) // Validation error
    })
  })
})