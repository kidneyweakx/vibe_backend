import { prisma } from '../../dbConfig'

export interface CreateUserData {
  email: string
  name?: string
  avatar?: string
  provider: 'google' | 'apple' | 'password' | 'test'
  providerId: string
  passwordHash?: string
}

export interface UpdateUserData {
  name?: string
  avatar?: string
}

export class UserService {
  static async upsertUser(data: CreateUserData) {
    return await prisma.user.upsert({
      where: {
        provider_providerId: {
          provider: data.provider,
          providerId: data.providerId
        }
      },
      update: {
        email: data.email,
        name: data.name,
        avatar: data.avatar,
        updatedAt: new Date()
      },
      create: data
    })
  }

  static async getUserById(id: string) {
    return await prisma.user.findUnique({
      where: { id }
    })
  }

  static async getUserByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email }
    })
  }

  static async getUserByProvider(provider: string, providerId: string) {
    return await prisma.user.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId
        }
      }
    })
  }

  static async updateUser(id: string, data: UpdateUserData) {
    return await prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    })
  }

  static async deleteUser(id: string) {
    return await prisma.user.delete({
      where: { id }
    })
  }

  static async createTestUser(email: string, name?: string) {
    return await this.upsertUser({
      email,
      name: name || 'Test User',
      provider: 'test',
      providerId: `test_${Date.now()}`
    })
  }

  static async getUserPublicInfo(userId: string) {
    try {
      // 獲取用戶基本信息
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          avatar: true,
          gender: true,
          createdAt: true
        }
      })

      if (!user) {
        throw new Error('User not found')
      }

      // 獲取用戶照片數量
      const photoCount = await prisma.photo.count({
        where: { userId }
      })

      // 獲取評分統計
      const likeCount = await prisma.rating.count({
        where: { ratedUserId: userId, type: 'like' }
      })
      
      const normalCount = await prisma.rating.count({
        where: { ratedUserId: userId, type: 'normal' }
      })
      
      const totalRatings = likeCount + normalCount
      
      // 計算總分
      const totalScore = totalRatings > 0 
        ? Math.round(((likeCount * 1 + normalCount * 0.2) / totalRatings) * 100)
        : 0

      // 獲取最新的幾張照片
      const recentPhotos = await prisma.photo.findMany({
        where: { userId },
        select: {
          id: true,
          url: true,
          uploadedAt: true
        },
        orderBy: { uploadedAt: 'desc' },
        take: 6
      })

      return {
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          gender: user.gender,
          memberSince: user.createdAt
        },
        stats: {
          totalScore,
          likeCount,
          normalCount,
          totalRatings,
          photoCount
        },
        recentPhotos,
        shareInfo: {
          shareUrl: `${process.env.FRONTEND_URL || 'https://vibe.app'}/user/${userId}`,
          shareText: `查看 ${user.name} 在 Vibe 的個人資料！總分: ${totalScore}/100 ⭐`,
          qrCodeUrl: `${process.env.API_URL || 'http://localhost:8181'}/user/qr/${userId}`
        }
      }
    } catch (error: any) {
      throw error
    }
  }

  static async generateShareableLink(userId: string) {
    try {
      const user = await this.getUserById(userId)
      if (!user) {
        throw new Error('User not found')
      }

      const shareData = {
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        shareUrl: `${process.env.FRONTEND_URL || 'https://vibe.app'}/user/${userId}`,
        apiUrl: `${process.env.API_URL || 'http://localhost:8181'}/user/info/${userId}`,
        qrCodeUrl: `${process.env.API_URL || 'http://localhost:8181'}/user/qr/${userId}`,
        createdAt: new Date().toISOString()
      }

      return shareData
    } catch (error: any) {
      throw error
    }
  }
}