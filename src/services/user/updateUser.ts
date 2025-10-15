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
  if (!id || typeof id !== 'string') {
    throw new Error('User not found')
  }
  return await getPrisma().user.update({ where: { id }, data: { ...data, updatedAt: new Date() } })
}

/**
 * Soft delete user - preserves ID but clears all personal data
 * ID is never recycled to maintain data integrity
 */
export async function deleteUser(id: string) {
  if (!id || typeof id !== 'string') {
    throw new Error('User not found')
  }
  const prisma = getPrisma()

  // First delete all user's data (cascade will handle related records)
  await prisma.photo.deleteMany({ where: { userId: id } })
  await prisma.rating.deleteMany({ where: { raterId: id } })

  // Soft delete: clear personal data but keep the user ID
  return await prisma.user.update({
    where: { id },
    data: {
      email: `deleted_${id}@deleted.local`,
      name: null,
      avatar: null,
      gender: null,
      provider: 'deleted',
      providerId: `deleted_${id}`,
      deviceId: null,
      bio: null,
      location: null,
      language: null,
      timezone: null,
      notificationsEnabled: false,
      ageRange: null,
      vibeLevel: 0,
      timeInvestmentHours: 0,
      tosVersion: null,
      privacyVersion: null,
      onboardedAt: null,
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


