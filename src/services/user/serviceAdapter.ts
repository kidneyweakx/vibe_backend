import { upsertUser, type CreateUserData, getUserById, getUserByEmail, getUserByProvider, updateUser as svcUpdateUser, deleteUser as svcDeleteUser, createTestUser, getUserPublicInfo, generateShareableLink } from './index'

export interface UpdateUserData {
  name?: string
  avatar?: string
  gender?: string
}

export class UserService {
  static async upsertUser(data: CreateUserData) {
    return upsertUser(data)
  }
  static async getUserById(id: string) {
    return getUserById(id)
  }
  static async getUserByEmail(email: string) {
    return getUserByEmail(email)
  }
  static async getUserByProvider(provider: string, providerId: string) {
    return getUserByProvider(provider, providerId)
  }
  static async updateUser(id: string, data: UpdateUserData) {
    return svcUpdateUser(id, data)
  }
  static async deleteUser(id: string) {
    return svcDeleteUser(id)
  }
  static async createTestUser(email: string, name?: string) {
    return createTestUser(email, name)
  }
  static async getUserPublicInfo(userId: string) {
    return getUserPublicInfo(userId)
  }
  static async generateShareableLink(userId: string) {
    return generateShareableLink(userId)
  }
}


