import getPrisma from '../../dbConfig'

export interface CreateUserData {
  email: string
  name?: string
  avatar?: string
  gender?: string
  provider: 'google' | 'apple' | 'password' | 'test' | 'guest'
  providerId: string
  passwordHash?: string
}

export interface UpdateUserData {
  name?: string
  avatar?: string
  gender?: string
}

export class UserService {
  static async upsertUser(data: CreateUserData) {
    const prisma = getPrisma()
    // Ensure required fields are safe. For providers that may not supply email (e.g., Apple after first login),
    // callers should synthesize a placeholder email. We double-check here to avoid empty emails.
    const safeEmail = data.email && data.email.trim().length > 0 ? data.email : `${data.provider}_${data.providerId}@placeholder.local`
    try {
      return await prisma.user.upsert({
        where: {
          provider_providerId: {
            provider: data.provider,
            providerId: data.providerId
          }
        },
        update: {
          email: safeEmail,
          name: data.name,
          avatar: data.avatar,
          gender: data.gender,
          updatedAt: new Date()
        },
        create: {
          ...data,
          email: safeEmail
        }
      })
    } catch (error: any) {
      // Handle unique email conflicts by merging accounts based on email
      // Normalize message to lower-case to avoid case-sensitivity pitfalls across drivers
      const message: string = typeof error?.message === 'string' ? error.message.toLowerCase() : ''
      const isUniqueEmailConflict =
        error?.code === 'P2002' ||
        (message.includes('unique constraint') && message.includes('email'))
      if (!isUniqueEmailConflict) throw error

      const existingByEmail = await prisma.user.findUnique({ where: { email: safeEmail } })
      if (!existingByEmail) throw error

      // Merge: update the existing user with the latest provider info and profile fields
      return prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          provider: data.provider,
          providerId: data.providerId,
          name: data.name ?? existingByEmail.name,
          avatar: data.avatar ?? existingByEmail.avatar,
          gender: data.gender ?? existingByEmail.gender ?? undefined,
          updatedAt: new Date()
        }
      })
    }
  }

  static async getUserById(id: string) {
    return await getPrisma().user.findUnique({
      where: { id }
    })
  }

  static async getUserByEmail(email: string) {
    return await getPrisma().user.findUnique({
      where: { email }
    })
  }

  static async getUserByProvider(provider: string, providerId: string) {
    return await getPrisma().user.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId
        }
      }
    })
  }

  static async updateUser(id: string, data: UpdateUserData) {
    return await getPrisma().user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    })
  }

  static async deleteUser(id: string) {
    return await getPrisma().user.delete({
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
      const user = await getPrisma().user.findUnique({
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
      const photoCount = await getPrisma().photo.count({
        where: { userId }
      })

      // 獲取評分統計
      const likeCount = await getPrisma().rating.count({
        where: { ratedUserId: userId, type: 'like' }
      })
      
      const normalCount = await getPrisma().rating.count({
        where: { ratedUserId: userId, type: 'normal' }
      })
      
      const totalRatings = likeCount + normalCount
      
      // 計算總分
      const totalScore = totalRatings > 0 
        ? Math.round(((likeCount * 1 + normalCount * 0.2) / totalRatings) * 100)
        : 0

      // 獲取最新的幾張照片
      const recentPhotos = await getPrisma().photo.findMany({
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