import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { Elysia } from 'elysia'
import { tagModule } from '../src/routes/tag'
import { fileModule } from '../src/modules/file'
import { testPrisma, testUsers, testTags, cleanupTestData, setupTestData, mockAuthUser } from './setup'

// Mock R2 相關服務
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

describe('Integration Tests - Photo & Tag System', () => {
  let app: Elysia

  beforeEach(async () => {
    await cleanupTestData()
    await setupTestData()
    
    // 創建完整的測試應用
    app = new Elysia()
      .decorate('prisma', testPrisma)
      .derive(() => mockAuthUser('user1'))
      .use(fileModule)
      .use(tagModule)
  })

  describe('Complete Photo Upload and Tagging Workflow', () => {
    it('should upload photo, add tags, and retrieve with tags', async () => {
      // 1. 上傳照片
      const base64Data = btoa('fake image data')
      const uploadResponse = await app.handle(
        new Request('http://localhost/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: base64Data,
            format: 'jpg'
          })
        })
      )
      
      const uploadResult = await uploadResponse.json()
      expect(uploadResponse.status).toBe(200)
      expect(uploadResult.photoId).toBeDefined()
      
      const photoId = uploadResult.photoId
      
      // 2. 為照片添加標籤
      const tagResponse = await app.handle(
        new Request(`http://localhost/tags/photos/${photoId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tagIds: [testTags[0].id, testTags[1].id]
          })
        })
      )
      
      const tagResult = await tagResponse.json()
      expect(tagResponse.status).toBe(200)
      expect(tagResult.success).toBe(true)
      
      // 3. 獲取照片標籤
      const getTagsResponse = await app.handle(
        new Request(`http://localhost/tags/photos/${photoId}`)
      )
      
      const getTagsResult = await getTagsResponse.json()
      expect(getTagsResponse.status).toBe(200)
      expect(getTagsResult.data).toHaveLength(2)
      
      // 4. 獲取用戶照片（應該包含標籤）
      const photosResponse = await app.handle(
        new Request('http://localhost/files/photos')
      )
      
      const photosResult = await photosResponse.json()
      expect(photosResponse.status).toBe(200)
      
      const uploadedPhoto = photosResult.photos.find((p: any) => p.id === photoId)
      expect(uploadedPhoto).toBeDefined()
      expect(uploadedPhoto.tags).toHaveLength(2)
      
      // 5. 根據標籤搜索照片
      const searchParams = [testTags[0].id, testTags[1].id]
        .map(id => `tagIds[]=${id}`)
        .join('&')
      
      const searchResponse = await app.handle(
        new Request(`http://localhost/tags/search?${searchParams}`)
      )
      
      const searchResult = await searchResponse.json()
      expect(searchResponse.status).toBe(200)
      expect(searchResult.data).toHaveLength(1)
      expect(searchResult.data[0].id).toBe(photoId)
    })

    it('should handle photo deletion with tag cleanup', async () => {
      // 1. 上傳照片
      const base64Data = btoa('fake image data')
      const uploadResponse = await app.handle(
        new Request('http://localhost/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: base64Data,
            format: 'jpg'
          })
        })
      )
      
      const uploadResult = await uploadResponse.json()
      const photoId = uploadResult.photoId
      
      // 2. 為照片添加標籤
      await app.handle(
        new Request(`http://localhost/tags/photos/${photoId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tagIds: [testTags[0].id, testTags[1].id]
          })
        })
      )
      
      // 3. 確認標籤已添加
      let photoTags = await testPrisma.photoTag.findMany({
        where: { photoId }
      })
      expect(photoTags).toHaveLength(2)
      
      // 4. 刪除照片
      const deleteResponse = await app.handle(
        new Request(`http://localhost/files/photos/${photoId}`, {
          method: 'DELETE'
        })
      )
      
      const deleteResult = await deleteResponse.json()
      expect(deleteResponse.status).toBe(200)
      expect(deleteResult.success).toBe(true)
      
      // 5. 確認照片和標籤關聯都已刪除
      const deletedPhoto = await testPrisma.photo.findUnique({
        where: { id: photoId }
      })
      expect(deletedPhoto).toBeNull()
      
      photoTags = await testPrisma.photoTag.findMany({
        where: { photoId }
      })
      expect(photoTags).toHaveLength(0)
      
      // 6. 標籤本身應該還存在
      const tags = await testPrisma.tag.findMany({
        where: { id: { in: [testTags[0].id, testTags[1].id] } }
      })
      expect(tags).toHaveLength(2)
    })
  })

  describe('Multi-User Photo Tagging Scenarios', () => {
    it('should handle multiple users tagging photos independently', async () => {
      // 創建兩個用戶的應用實例
      const user1App = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user1'))
        .use(fileModule)
        .use(tagModule)
      
      const user2App = new Elysia()
        .decorate('prisma', testPrisma)
        .derive(() => mockAuthUser('user2'))
        .use(fileModule)
        .use(tagModule)
      
      // User1 上傳照片並添加標籤
      const base64Data = btoa('fake image data')
      
      const user1Upload = await user1App.handle(
        new Request('http://localhost/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: base64Data,
            format: 'jpg'
          })
        })
      )
      
      const user1Photo = await user1Upload.json()
      
      await user1App.handle(
        new Request(`http://localhost/tags/photos/${user1Photo.photoId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tagIds: [testTags[0].id]
          })
        })
      )
      
      // User2 上傳照片並添加不同標籤
      const user2Upload = await user2App.handle(
        new Request('http://localhost/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: base64Data,
            format: 'png'
          })
        })
      )
      
      const user2Photo = await user2Upload.json()
      
      await user2App.handle(
        new Request(`http://localhost/tags/photos/${user2Photo.photoId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tagIds: [testTags[1].id, testTags[2].id]
          })
        })
      )
      
      // 搜索不同標籤應該返回不同用戶的照片
      const searchTag0 = await app.handle(
        new Request(`http://localhost/tags/search?tagIds[]=${testTags[0].id}`)
      )
      const searchTag0Result = await searchTag0.json()
      expect(searchTag0Result.data).toHaveLength(1)
      expect(searchTag0Result.data[0].userId).toBe(testUsers.user1.id)
      
      const searchTag1 = await app.handle(
        new Request(`http://localhost/tags/search?tagIds[]=${testTags[1].id}`)
      )
      const searchTag1Result = await searchTag1.json()
      expect(searchTag1Result.data).toHaveLength(1)
      expect(searchTag1Result.data[0].userId).toBe(testUsers.user2.id)
      
      // User2 不應該能為 User1 的照片添加標籤
      const unauthorizedTag = await user2App.handle(
        new Request(`http://localhost/tags/photos/${user1Photo.photoId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tagIds: [testTags[2].id]
          })
        })
      )
      
      expect(unauthorizedTag.status).toBe(404)
    })
  })

  describe('Tag Popularity and Statistics', () => {
    it('should correctly calculate tag popularity across multiple photos', async () => {
      // 創建多張照片並添加不同標籤
      const photos = []
      
      for (let i = 0; i < 3; i++) {
        const uploadResponse = await app.handle(
          new Request('http://localhost/files/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageData: btoa(`fake image data ${i}`),
              format: 'jpg'
            })
          })
        )
        
        const uploadResult = await uploadResponse.json()
        photos.push(uploadResult.photoId)
      }
      
      // 為照片添加標籤：
      // Photo 0: tag0, tag1
      // Photo 1: tag0, tag2
      // Photo 2: tag1
      // 結果：tag0=2次, tag1=2次, tag2=1次
      
      await app.handle(
        new Request(`http://localhost/tags/photos/${photos[0]}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tagIds: [testTags[0].id, testTags[1].id]
          })
        })
      )
      
      await app.handle(
        new Request(`http://localhost/tags/photos/${photos[1]}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tagIds: [testTags[0].id, testTags[2].id]
          })
        })
      )
      
      await app.handle(
        new Request(`http://localhost/tags/photos/${photos[2]}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tagIds: [testTags[1].id]
          })
        })
      )
      
      // 獲取熱門標籤
      const popularResponse = await app.handle(
        new Request('http://localhost/tags/popular')
      )
      
      const popularResult = await popularResponse.json()
      expect(popularResponse.status).toBe(200)
      expect(popularResult.data).toHaveLength(3)
      
      // 檢查排序（使用次數多的在前面）
      const sortedTags = popularResult.data.sort((a: any, b: any) => 
        b._count.photoTags - a._count.photoTags
      )
      
      expect(sortedTags[0]._count.photoTags).toBe(2) // tag0 或 tag1
      expect(sortedTags[1]._count.photoTags).toBe(2) // tag0 或 tag1
      expect(sortedTags[2]._count.photoTags).toBe(1) // tag2
    })
  })

  describe('Complex Search Scenarios', () => {
    it('should handle complex tag-based photo searches', async () => {
      // 創建多張照片並添加不同的標籤組合
      const photoData = [
        { tags: [testTags[0].id, testTags[1].id] }, // sporty + streetwear
        { tags: [testTags[1].id, testTags[2].id] }, // streetwear + vintage
        { tags: [testTags[0].id, testTags[2].id] }, // sporty + vintage
        { tags: [testTags[0].id] }                  // sporty only
      ]
      
      const photoIds = []
      
      for (let i = 0; i < photoData.length; i++) {
        const uploadResponse = await app.handle(
          new Request('http://localhost/files/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageData: btoa(`fake image data ${i}`),
              format: 'jpg'
            })
          })
        )
        
        const uploadResult = await uploadResponse.json()
        photoIds.push(uploadResult.photoId)
        
        await app.handle(
          new Request(`http://localhost/tags/photos/${uploadResult.photoId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tagIds: photoData[i].tags
            })
          })
        )
      }
      
      // 搜索包含 sporty 標籤的照片（應該返回 3 張）
      const sportySearch = await app.handle(
        new Request(`http://localhost/tags/search?tagIds[]=${testTags[0].id}`)
      )
      const sportyResult = await sportySearch.json()
      expect(sportyResult.data).toHaveLength(3)
      
      // 搜索包含 streetwear 標籤的照片（應該返回 2 張）
      const streetwearSearch = await app.handle(
        new Request(`http://localhost/tags/search?tagIds[]=${testTags[1].id}`)
      )
      const streetwearResult = await streetwearSearch.json()
      expect(streetwearResult.data).toHaveLength(2)
      
      // 搜索包含 sporty 或 vintage 標籤的照片（應該返回所有 4 張）
      const multiTagSearch = await app.handle(
        new Request(`http://localhost/tags/search?tagIds[]=${testTags[0].id}&tagIds[]=${testTags[2].id}`)
      )
      const multiTagResult = await multiTagSearch.json()
      expect(multiTagResult.data).toHaveLength(4)
      
      // 測試分頁
      const paginatedSearch = await app.handle(
        new Request(`http://localhost/tags/search?tagIds[]=${testTags[0].id}&limit=2&offset=1`)
      )
      const paginatedResult = await paginatedSearch.json()
      expect(paginatedResult.data).toHaveLength(2)
    })
  })
})