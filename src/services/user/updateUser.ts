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

export async function updateUser(id: number | string, data: UpdateUserData) {
  const numericId = typeof id === 'number' ? id : Number(id)
  if (!Number.isFinite(numericId)) {
    throw new Error('User not found')
  }
  return await getPrisma().user.update({ where: { id: numericId }, data: { ...data, updatedAt: new Date() } })
}

/**
 * Soft delete user - preserves ID but clears all personal data
 * ID is never recycled to maintain data integrity
 */
export async function deleteUser(id: number | string) {
  const numericId = typeof id === 'number' ? id : Number(id)
  if (!Number.isFinite(numericId)) {
    throw new Error('User not found')
  }
  const prisma = getPrisma()

  // First delete all user's data (cascade will handle related records)
  await prisma.photo.deleteMany({ where: { userId: numericId } })
  await prisma.rating.deleteMany({ where: { raterId: numericId } })
  await prisma.onboarding.deleteMany({ where: { userId: numericId } })

  // Soft delete: clear personal data but keep the user ID
  return await prisma.user.update({
    where: { id: numericId },
    data: {
      email: `deleted_${numericId}@deleted.local`,
      name: null,
      avatar: null,
      gender: null,
      provider: null,
      providerId: null,
      deviceId: null,
      bio: null,
      location: null,
      language: null,
      timezone: null,
      isDeleted: true,
      deletedAt: new Date(),
      // Reset stats
      eloRating: 1500.0,
      totalScore: 0,
      likeCount: 0,
      normalCount: 0,
      totalRatings: 0,
      lastRatedAt: null
    }
  })
}


