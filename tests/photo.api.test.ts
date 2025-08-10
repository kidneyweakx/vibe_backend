import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { Elysia } from 'elysia'
import { fileModule } from '../src/modules/file'
import { testPrisma, testUsers, testPhotos, testTags, cleanupTestData, setupTestData, mockAuthUser } from './setup'

// Mock R2 和相關服務
mock.module('../src/modules/file/r2Client', () => ({
  getR2Client: () => ({
    client: {
      send: mock(() => Promise.resolve({}))
    },
    bucketName: 'test-bucket',
    accountId: 'test-account'
  })
}))

mock.module('../src/modules/file/presign', () => ({
  getPublicObjectUrl: mock((key: string) => `https://example.com/${key}`),
  getPresignedGetUrl: mock((key: string) => Promise.resolve(`https://example.com/signed/${key}`))
}))

mock.module('../src/dbConfig', () => ({
  default: () => testPrisma
}))

describe('Photo API', () => {
  let app: Elysia

  beforeEach(async () => {
    await cleanupTestData()
    await setupTestData()
    
    // 創建測試應用
    app = new Elysia()
      .decorate('prisma', testPrisma)
      .use(fileModule)
  })

  describe('POST /files/upload', () => {
    it('should upload photo for authenticated user', async () => {
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(fileModule)
      
      const base64Data = btoa('fake image data')
      const requestBody = {
        imageData: base64Data,
        format: 'jpg'
      }
      
      const response = await testApp.handle(
        new Request('http://localhost/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
      )
      
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.photoId).toBeDefined()
      expect(result.urls.original).toBeDefined()
      expect(result.uploadedAt).toBeDefined()
      
      // 驗證數據庫記錄
      const photo = await testPrisma.photo.findUnique({
        where: { id: result.photoId }
      })
      expect(photo).toBeDefined()
      expect(photo?.userId).toBe(testUsers.user1.id)
    })

    it('should handle guest user upload', async () => {
      const guestUserId = 'guest_12345'
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => ({ user: { id: guestUserId } }))
        .use(fileModule)
      
      const base64Data = btoa('fake image data')
      const requestBody = {
        imageData: base64Data,
        format: 'png'
      }
      
      const response = await testApp.handle(
        new Request('http://localhost/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
      )
      
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.photoId).toBeDefined()
      
      // 驗證 guest 用戶已創建
      const guestUser = await testPrisma.user.findUnique({
        where: { id: guestUserId }
      })
      expect(guestUser).toBeDefined()
      expect(guestUser?.provider).toBe('guest')
    })

    it('should validate required fields', async () => {
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(fileModule)
      
      const requestBody = {
        // 缺少 imageData
        format: 'jpg'
      }
      
      const response = await testApp.handle(
        new Request('http://localhost/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
      )
      
      expect(response.status).toBe(422) // Validation error
    })

    it('should handle different image formats', async () => {
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(fileModule)
      
      const base64Data = btoa('fake image data')
      const formats = ['jpg', 'png', 'gif', 'webp']
      
      for (const format of formats) {
        const requestBody = {
          imageData: base64Data,
          format
        }
        
        const response = await testApp.handle(
          new Request('http://localhost/files/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          })
        )
        
        const result = await response.json()
        
        expect(response.status).toBe(200)
        expect(result.photoId).toBeDefined()
        
        const photo = await testPrisma.photo.findUnique({
          where: { id: result.photoId }
        })
        expect(photo?.format).toBe(format)
      }
    })
  })

  describe('GET /files/photos', () => {
    it('should return user photos with tags for authenticated user', async () => {
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(fileModule)
      
      // 為照片添加標籤
      await testPrisma.photoTag.createMany({
        data: [
          { photoId: testPhotos[0].id, tagId: testTags[0].id },
          { photoId: testPhotos[0].id, tagId: testTags[1].id }
        ]
      })
      
      const response = await testApp.handle(
        new Request('http://localhost/files/photos')
      )
      
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.photos).toHaveLength(2) // user1 有兩張照片
      expect(result.totalCount).toBe(2)
      expect(result.hasMore).toBe(false)
      
      // 檢查照片包含標籤信息
      const photoWithTags = result.photos.find((p: any) => p.id === testPhotos[0].id)
      expect(photoWithTags.tags).toHaveLength(2)
      expect(photoWithTags.tags[0]).toMatchObject({
        name: expect.any(String),
        displayName: expect.any(String)
      })
    })

    it('should handle pagination parameters', async () => {
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(fileModule)
      
      // 創建更多照片用於測試分頁
      const additionalPhotos = Array.from({ length: 5 }, (_, i) => ({
        id: `additional_photo_${i}`,
        userId: testUsers.user1.id,
        key: `test/additional_${i}.jpg`,
        url: `https://example.com/additional_${i}.jpg`,
        format: 'jpg',
        size: 1024
      }))
      
      await testPrisma.photo.createMany({
        data: additionalPhotos
      })
      
      const response = await testApp.handle(
        new Request('http://localhost/files/photos?page=1&limit=3')
      )
      
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.photos).toHaveLength(3)
      expect(result.totalCount).toBe(7) // 2 + 5
      expect(result.hasMore).toBe(true)
    })

    it('should return empty result for user with no photos', async () => {
      // 創建一個沒有照片的新用戶
      const newUser = {
        id: 'user_no_photos',
        email: 'nophotos@example.com',
        name: 'No Photos User',
        provider: 'test',
        providerId: 'user_no_photos'
      }
      
      await testPrisma.user.create({ data: newUser })
      
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => ({ user: newUser }))
        .use(fileModule)
      
      const response = await testApp.handle(
        new Request('http://localhost/files/photos')
      )
      
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.photos).toHaveLength(0)
      expect(result.totalCount).toBe(0)
      expect(result.hasMore).toBe(false)
    })
  })

  describe('DELETE /files/photos/:photoId', () => {
    it('should delete photo for authenticated user', async () => {
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(fileModule)
      
      const photoId = testPhotos[0].id
      
      // 為照片添加標籤和評分
      await testPrisma.photoTag.create({
        data: { photoId, tagId: testTags[0].id }
      })
      
      const response = await testApp.handle(
        new Request(`http://localhost/files/photos/${photoId}`, {
          method: 'DELETE'
        })
      )
      
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      
      // 驗證照片已刪除
      const deletedPhoto = await testPrisma.photo.findUnique({
        where: { id: photoId }
      })
      expect(deletedPhoto).toBeNull()
      
      // 驗證關聯的標籤也已刪除
      const photoTags = await testPrisma.photoTag.findMany({
        where: { photoId }
      })
      expect(photoTags).toHaveLength(0)
    })

    it('should return 404 for non-existent photo', async () => {
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(fileModule)
      
      const response = await testApp.handle(
        new Request('http://localhost/files/photos/non-existent-photo', {
          method: 'DELETE'
        })
      )
      
      const result = await response.json()
      
      expect(response.status).toBe(404)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Photo not found')
    })

    it('should return 403 when user tries to delete another users photo', async () => {
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(fileModule)
      
      // 嘗試刪除 user2 的照片
      const response = await testApp.handle(
        new Request(`http://localhost/files/photos/${testPhotos[2].id}`, {
          method: 'DELETE'
        })
      )
      
      const result = await response.json()
      
      expect(response.status).toBe(403)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Unauthorized to delete this photo')
    })
  })

  describe('GET /files/test-config', () => {
    it('should test R2 configuration', async () => {
      const response = await app.handle(
        new Request('http://localhost/files/test-config')
      )
      
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })
  })

  describe('POST /files/verify', () => {
    it('should verify file existence', async () => {
      const requestBody = {
        key: 'existing-file-key'
      }
      
      const response = await app.handle(
        new Request('http://localhost/files/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
      )
      
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.exists).toBe(true)
    })

    it('should validate required key parameter', async () => {
      const requestBody = {
        // 缺少 key
      }
      
      const response = await app.handle(
        new Request('http://localhost/files/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
      )
      
      expect(response.status).toBe(422) // Validation error
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      const originalFind = testPrisma.photo.findMany
      testPrisma.photo.findMany = mock(() => Promise.reject(new Error('Database error')))
      
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(fileModule)
      
      const response = await testApp.handle(
        new Request('http://localhost/files/photos')
      )
      
      expect(response.status).toBe(500)
      
      // 恢復原始方法
      testPrisma.photo.findMany = originalFind
    })

    it('should handle R2 upload errors', async () => {
      // Mock R2 upload failure
      mock.module('../src/modules/file/r2Client', () => ({
        getR2Client: () => ({
          client: {
            send: mock(() => Promise.reject(new Error('R2 upload failed')))
          },
          bucketName: 'test-bucket',
          accountId: 'test-account'
        })
      }))
      
      const testApp = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(fileModule)
      
      const base64Data = btoa('fake image data')
      const requestBody = {
        imageData: base64Data,
        format: 'jpg'
      }
      
      const response = await testApp.handle(
        new Request('http://localhost/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
      )
      
      expect(response.status).toBe(500)
    })
  })
})