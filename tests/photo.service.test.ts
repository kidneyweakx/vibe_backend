import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { uploadPhoto, getUserPhotos, deletePhoto, uploadToR2, verifyFile, testR2Config } from '../src/modules/file/service'
import { testPrisma, testUsers, testPhotos, testTags, cleanupTestData, setupTestData } from './setup'

// Mock R2 相關函數
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

describe('Photo Service', () => {
  beforeEach(async () => {
    await cleanupTestData()
    await setupTestData()
  })

  describe('uploadToR2', () => {
    it('should upload file successfully', async () => {
      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      
      const result = await uploadToR2(mockFile, { key: 'test/upload.jpg' })
      
      expect(result.success).toBe(true)
      expect(result.url).toBeDefined()
      expect(result.key).toBe('test/upload.jpg')
    })

    it('should validate file type', async () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })
      
      const result = await uploadToR2(mockFile)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid file type. Only images are allowed')
    })

    it('should validate file size', async () => {
      const largeContent = new Array(11 * 1024 * 1024).fill('a').join('') // 11MB
      const mockFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' })
      
      const result = await uploadToR2(mockFile)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('File size exceeds limit')
    })

    it('should use custom options', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const options = {
        key: 'custom/path.jpg',
        maxSize: 1024,
        allowedTypes: ['image/jpeg']
      }
      
      const result = await uploadToR2(mockFile, options)
      
      expect(result.success).toBe(true)
      expect(result.key).toBe('custom/path.jpg')
    })
  })

  describe('verifyFile', () => {
    it('should return true for existing file', async () => {
      const exists = await verifyFile('existing-key')
      
      expect(exists).toBe(true)
    })
  })

  describe('testR2Config', () => {
    it('should test R2 configuration', async () => {
      const result = await testR2Config()
      
      expect(result.success).toBe(true)
    })
  })

  describe('uploadPhoto', () => {
    it('should upload photo for existing user', async () => {
      const base64Data = btoa('fake image data')
      const userId = testUsers.user1.id
      
      const result = await uploadPhoto(base64Data, userId, 'jpg')
      
      expect(result.photoId).toBeDefined()
      expect(result.urls.original).toBeDefined()
      expect(result.uploadedAt).toBeDefined()
      
      // 驗證數據庫記錄
      const photo = await testPrisma.photo.findUnique({
        where: { id: result.photoId }
      })
      expect(photo).toBeDefined()
      expect(photo?.userId).toBe(userId)
      expect(photo?.format).toBe('jpg')
    })

    it('should create guest user and upload photo', async () => {
      const base64Data = btoa('fake image data')
      const guestUserId = 'guest_12345'
      
      const result = await uploadPhoto(base64Data, guestUserId, 'png')
      
      expect(result.photoId).toBeDefined()
      
      // 驗證 guest 用戶已創建
      const guestUser = await testPrisma.user.findUnique({
        where: { id: guestUserId }
      })
      expect(guestUser).toBeDefined()
      expect(guestUser?.provider).toBe('guest')
      expect(guestUser?.email).toBe(`${guestUserId}@guest.local`)
      
      // 驗證照片記錄
      const photo = await testPrisma.photo.findUnique({
        where: { id: result.photoId }
      })
      expect(photo?.userId).toBe(guestUserId)
      expect(photo?.format).toBe('png')
    })

    it('should throw error for non-existent user', async () => {
      const base64Data = btoa('fake image data')
      const nonExistentUserId = 'non-existent-user'
      
      await expect(uploadPhoto(base64Data, nonExistentUserId, 'jpg')).rejects.toThrow()
    })

    it('should handle different image formats', async () => {
      const base64Data = btoa('fake image data')
      const userId = testUsers.user1.id
      
      const formats = ['jpg', 'png', 'gif', 'webp']
      
      for (const format of formats) {
        const result = await uploadPhoto(base64Data, userId, format)
        
        expect(result.photoId).toBeDefined()
        
        const photo = await testPrisma.photo.findUnique({
          where: { id: result.photoId }
        })
        expect(photo?.format).toBe(format)
      }
    })
  })

  describe('getUserPhotos', () => {
    it('should return user photos with tags', async () => {
      const userId = testUsers.user1.id
      
      // 為照片添加標籤
      await testPrisma.photoTag.createMany({
        data: [
          { photoId: testPhotos[0].id, tagId: testTags[0].id },
          { photoId: testPhotos[0].id, tagId: testTags[1].id },
          { photoId: testPhotos[1].id, tagId: testTags[2].id }
        ]
      })
      
      const result = await getUserPhotos(userId)
      
      expect(result.photos).toHaveLength(2) // user1 有兩張照片
      expect(result.totalCount).toBe(2)
      expect(result.hasMore).toBe(false)
      
      // 檢查照片包含標籤信息
      const photoWithTags = result.photos.find(p => p.id === testPhotos[0].id)
      expect(photoWithTags?.tags).toHaveLength(2)
      expect(photoWithTags?.tags?.[0]).toMatchObject({
        name: expect.any(String),
        displayName: expect.any(String)
      })
    })

    it('should handle pagination', async () => {
      const userId = testUsers.user1.id
      
      // 創建更多照片用於測試分頁
      const additionalPhotos = Array.from({ length: 5 }, (_, i) => ({
        id: `additional_photo_${i}`,
        userId,
        key: `test/additional_${i}.jpg`,
        url: `https://example.com/additional_${i}.jpg`,
        format: 'jpg',
        size: 1024
      }))
      
      await testPrisma.photo.createMany({
        data: additionalPhotos
      })
      
      // 測試第一頁
      const page1 = await getUserPhotos(userId, 1, 3)
      expect(page1.photos).toHaveLength(3)
      expect(page1.totalCount).toBe(7) // 2 + 5
      expect(page1.hasMore).toBe(true)
      
      // 測試第二頁
      const page2 = await getUserPhotos(userId, 2, 3)
      expect(page2.photos).toHaveLength(3)
      expect(page2.hasMore).toBe(true)
      
      // 測試第三頁
      const page3 = await getUserPhotos(userId, 3, 3)
      expect(page3.photos).toHaveLength(1)
      expect(page3.hasMore).toBe(false)
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
      
      const result = await getUserPhotos(newUser.id)
      
      expect(result.photos).toHaveLength(0)
      expect(result.totalCount).toBe(0)
      expect(result.hasMore).toBe(false)
    })

    it('should order photos by upload date descending', async () => {
      const userId = testUsers.user1.id
      
      const result = await getUserPhotos(userId)
      
      expect(result.photos).toHaveLength(2)
      
      // 檢查排序（假設 testPhotos[1] 比 testPhotos[0] 更新）
      const dates = result.photos.map(p => new Date(p.uploadedAt).getTime())
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i-1]).toBeGreaterThanOrEqual(dates[i])
      }
    })
  })

  describe('deletePhoto', () => {
    it('should delete photo and its associations', async () => {
      const photoId = testPhotos[0].id
      
      // 為照片添加標籤和評分
      await testPrisma.photoTag.create({
        data: { photoId, tagId: testTags[0].id }
      })
      
      await testPrisma.rating.create({
        data: {
          id: 'test_rating',
          raterId: testUsers.user2.id,
          ratedUserId: testUsers.user1.id,
          photoId,
          type: 'like'
        }
      })
      
      const result = await deletePhoto(photoId)
      
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
      
      // 驗證關聯的評分也已刪除
      const ratings = await testPrisma.rating.findMany({
        where: { photoId }
      })
      expect(ratings).toHaveLength(0)
    })

    it('should return error for non-existent photo', async () => {
      const result = await deletePhoto('non-existent-photo')
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Photo not found')
    })

    it('should handle R2 deletion errors gracefully', async () => {
      // Mock R2 deletion failure
      const originalMock = mock.module('../src/modules/file/r2Client', () => ({
        getR2Client: () => ({
          client: {
            send: mock(() => Promise.reject(new Error('R2 deletion failed')))
          },
          bucketName: 'test-bucket',
          accountId: 'test-account'
        })
      }))
      
      const photoId = testPhotos[0].id
      const result = await deletePhoto(photoId)
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      
      // 恢復原始 mock
      originalMock.restore?.()
    })
  })
})