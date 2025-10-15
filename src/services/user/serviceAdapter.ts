import {
  upsertUser,
  type CreateUserData,
  getUserById,
  getUserByEmail,
  getUserByProvider,
  getUserByDeviceId,
  createGuestUser,
  updateUser as svcUpdateUser,
  deleteUser as svcDeleteUser
} from './index'

export interface UpdateUserData {
  name?: string
  avatar?: string
  gender?: string
  bio?: string
  location?: string
  language?: string
  timezone?: string
  notificationsEnabled?: boolean
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
  static async getUserByDeviceId(deviceId: string) {
    return getUserByDeviceId(deviceId)
  }
  static async createGuestUser(deviceId: string) {
    return createGuestUser(deviceId)
  }
  static async updateUser(id: string, data: UpdateUserData) {
    return svcUpdateUser(id, data)
  }
  static async deleteUser(id: string) {
    return svcDeleteUser(id)
  }
}


