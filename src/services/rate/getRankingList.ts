import getPrisma from '../../dbConfig'
import { getPresignedGetUrl } from '../r2/presign'

export async function getRankingList(limit: number = 50) {
  const prisma = getPrisma()

  // Use materialized stats for much faster queries
  // TODO: Re-enable totalRatings filter once seed data is populated
  const allUsers = await prisma.user.findMany({
    where: {
      isGuest: false
      // totalRatings: { gt: 0 }  // Temporarily disabled for testing
    },
    select: {
      id: true,
      name: true,
      avatar: true,
      gender: true,
      eloRating: true,
      totalScore: true,
      likeCount: true,
      normalCount: true,
      totalRatings: true
    },
    orderBy: {
      eloRating: 'desc' // Sort by Elo rating instead of simple score
    }
  })

  // Get latest photo keys for users using ORM for better safety
  const userIds = allUsers.map(u => u.id)

  // Get latest photos for each user
  const latestPhotosData = await Promise.all(
    userIds.map(async (userId) => {
      const photo = await prisma.photo.findFirst({
        where: {
          userId,
          isProfilePicture: false,
          status: 'active'
        },
        orderBy: { uploadedAt: 'desc' },
        select: { userId: true, key: true }
      })
      return photo
    })
  )

  const photoMap = new Map(
    latestPhotosData
      .filter((p): p is { userId: string; key: string } => p !== null)
      .map(p => [p.userId, p.key])
  )

  // Generate presigned URLs for avatars
  const processedScores = await Promise.all(allUsers.map(async (user) => {
    let avatarUrl: string | undefined = undefined

    // Prioritize user's profile picture over latest uploaded photo
    if (user.avatar) {
      try {
        avatarUrl = await getPresignedGetUrl(user.avatar, 60 * 60 * 24 * 7) // 7 days expiry
      } catch (error) {
        console.warn(`Failed to generate presigned URL for profile picture ${user.avatar}:`, error)
      }
    }

    // Fallback to latest uploaded photo if no profile picture available
    if (!avatarUrl) {
      const latestPhotoKey = photoMap.get(user.id)
      if (latestPhotoKey) {
        try {
          avatarUrl = await getPresignedGetUrl(latestPhotoKey, 60 * 60 * 24 * 7) // 7 days expiry
        } catch (error) {
          console.warn(`Failed to generate presigned URL for latest photo ${latestPhotoKey}:`, error)
        }
      }
    }

    return {
      userId: user.id,
      name: user.name || 'Unknown',
      avatar: avatarUrl,
      gender: user.gender ?? undefined,
      totalScore: user.totalScore,
      likeCount: user.likeCount,
      normalCount: user.normalCount,
      totalRatings: user.totalRatings,
      eloRating: user.eloRating
    }
  }))

  // Get total users count (excluding guest users)
  const totalUsers = await prisma.user.count({ where: { isGuest: false } })

  // Generate rankings
  const overallUsers = processedScores.slice(0, limit).map((user, index) => ({
    ...user,
    rank: index + 1
  }))

  const maleUsers = processedScores
    .filter(u => u.gender === 'male')
    .slice(0, limit)
    .map((u, i) => ({ ...u, rank: i + 1 }))

  const femaleUsers = processedScores
    .filter(u => u.gender === 'female')
    .slice(0, limit)
    .map((u, i) => ({ ...u, rank: i + 1 }))

  return {
    overall: overallUsers,
    male: maleUsers,
    female: femaleUsers,
    totalUsers
  }
}


