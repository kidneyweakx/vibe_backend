import { prisma } from '../../dbConfig'

export interface CreateUserData {
  email: string
  name?: string
  avatar?: string
  provider: 'google' | 'apple' | 'test'
  providerId: string
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
}