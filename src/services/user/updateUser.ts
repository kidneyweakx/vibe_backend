import getPrisma from '../../dbConfig'

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

export async function updateUser(id: string, data: UpdateUserData) {
  return await getPrisma().user.update({ where: { id }, data: { ...data, updatedAt: new Date() } })
}

export async function deleteUser(id: string) {
  return await getPrisma().user.delete({ where: { id } })
}


