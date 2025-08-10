import { PrismaClient } from '@prisma/client'
import { beforeAll, afterAll, beforeEach } from 'bun:test'

// 測試數據庫配置
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test.db'
    }
  }
})

// 測試用戶數據
export const testUsers = {
  user1: {
    id: 'test_user_1',
    email: 'test1@example.com',
    name: 'Test User 1',
    provider: 'test',
    providerId: 'test_user_1'
  },
  user2: {
    id: 'test_user_2',
    email: 'test2@example.com',
    name: 'Test User 2',
    provider: 'test',
    providerId: 'test_user_2'
  }
}

// 測試標籤數據
export const testTags = [
  {
    id: 'test_tag_1',
    name: 'sporty',
    displayName: '運動風',
    emoji: '🏃‍♀️',
    color: '#FF6B35',
    category: 'style'
  },
  {
    id: 'test_tag_2',
    name: 'streetwear',
    displayName: '街頭潮流',
    emoji: '🛹',
    color: '#2E86AB',
    category: 'style'
  },
  {
    id: 'test_tag_3',
    name: 'vintage',
    displayName: '復古風',
    emoji: '📻',
    color: '#A23B72',
    category: 'style'
  }
]

// 測試照片數據
export const testPhotos = [
  {
    id: 'test_photo_1',
    userId: 'test_user_1',
    key: 'test/photo1.jpg',
    url: 'https://example.com/photo1.jpg',
    format: 'jpg',
    size: 1024
  },
  {
    id: 'test_photo_2',
    userId: 'test_user_1',
    key: 'test/photo2.jpg',
    url: 'https://example.com/photo2.jpg',
    format: 'jpg',
    size: 2048
  },
  {
    id: 'test_photo_3',
    userId: 'test_user_2',
    key: 'test/photo3.jpg',
    url: 'https://example.com/photo3.jpg',
    format: 'jpg',
    size: 1536
  }
]

// 清理測試數據
export async function cleanupTestData() {
  await testPrisma.photoTag.deleteMany()
  await testPrisma.photo.deleteMany()
  await testPrisma.tag.deleteMany()
  await testPrisma.rating.deleteMany()
  await testPrisma.user.deleteMany()
}

// 設置測試數據
export async function setupTestData() {
  // 創建測試用戶
  await testPrisma.user.createMany({
    data: Object.values(testUsers)
  })

  // 創建測試標籤
  await testPrisma.tag.createMany({
    data: testTags
  })

  // 創建測試照片
  await testPrisma.photo.createMany({
    data: testPhotos
  })
}

// 創建測試用的 JWT token
export function createTestToken(userId: string): string {
  // 這裡應該使用實際的 JWT 生成邏輯
  // 為了測試簡化，返回一個模擬的 token
  return `test_token_${userId}`
}

// Mock 認證中間件
export const mockAuthUser = (userId: string) => ({
  user: testUsers[userId as keyof typeof testUsers] || testUsers.user1
})

// 全局測試設置
beforeAll(async () => {
  // 運行數據庫遷移
  await testPrisma.$executeRaw`PRAGMA foreign_keys = ON`
})

afterAll(async () => {
  await cleanupTestData()
  await testPrisma.$disconnect()
})

beforeEach(async () => {
  await cleanupTestData()
  await setupTestData()
})