import getPrisma from '../../dbConfig'
import { getPresignedGetUrl } from '../r2/presign'

export async function getUserStats(userId: string) {
  const prisma = getPrisma()

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')

  // Use materialized stats instead of recalculating
  const totalScore = user.totalScore
  const likeCount = user.likeCount
  const normalCount = user.normalCount
  const totalRatings = user.totalRatings

  // Calculate overall rank efficiently using count
  const overallRank = await prisma.user.count({
    where: {
      isGuest: false,
      eloRating: { gt: user.eloRating }
    }
  }) + 1

  // Calculate gender rank if applicable
  let genderRank: number | undefined
  if (user.gender) {
    genderRank = await prisma.user.count({
      where: {
        gender: user.gender,
        isGuest: false,
        eloRating: { gt: user.eloRating }
      }
    }) + 1
  }

  // Get recent ratings
  const recentRatings = await prisma.rating.findMany({
    where: { ratedUserId: userId },
    include: { photo: true },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  return {
    userId: user.id,
    totalScore,
    likeCount,
    normalCount,
    totalRatings,
    overallRank,
    genderRank,
    eloRating: user.eloRating,
    recentRatings: await Promise.all(recentRatings.map(async (rating) => ({
      photoId: rating.photoId,
      photoUrl: await getPresignedGetUrl(rating.photo.key, 60 * 60 * 24 * 7),
      type: rating.type,
      createdAt: rating.createdAt
    })))
  }
}


