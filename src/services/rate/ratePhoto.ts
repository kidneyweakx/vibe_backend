import getPrisma from '../../dbConfig'
import { calculateEloUpdate, eloToScore } from '../../utils/eloRating'
import { invalidateUserCache } from './getRandomPhotosV2'

export async function ratePhoto(raterId: number | string, photoId: string, type: 'like' | 'normal') {
  try {
    if (!['like', 'normal'].includes(type)) {
      return { success: false, error: 'Type must be "like" or "normal"' }
    }

    const prisma = getPrisma()

    const photo = await prisma.photo.findUnique({ where: { id: photoId }, include: { user: true } })
    if (!photo) {
      return { success: false, error: 'Photo not found' }
    }

    const numericRaterId = typeof raterId === 'number' ? raterId : Number(raterId)
    if (!Number.isFinite(numericRaterId)) {
      return { success: false, error: 'Invalid rater identifier' }
    }

    if (photo.userId === numericRaterId) {
      return { success: false, error: 'Cannot rate your own photo' }
    }

    // Check if already rated
    const existingRating = await prisma.rating.findUnique({
      where: { raterId_photoId: { raterId: numericRaterId, photoId } }
    })
    if (existingRating) {
      return { success: false, error: 'You have already rated this photo' }
    }

    const rater = await prisma.user.findUnique({ where: { id: numericRaterId } })
    if (!rater) {
      return { success: false, error: 'Rater user not found' }
    }

    // Calculate Elo update
    const { newRatedUserElo } = calculateEloUpdate(photo.user.eloRating, rater.eloRating, type)
    const eloChange = newRatedUserElo - photo.user.eloRating

    // Update in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create rating record
      const rating = await tx.rating.create({
        data: {
          raterId: numericRaterId,
          ratedUserId: photo.userId,
          photoId,
          type,
          raterEloAtTime: rater.eloRating
        }
      })

      // Update rated user's stats
      const newLikeCount = type === 'like' ? photo.user.likeCount + 1 : photo.user.likeCount
      const newNormalCount = type === 'normal' ? photo.user.normalCount + 1 : photo.user.normalCount
      const newTotalRatings = photo.user.totalRatings + 1
      const newTotalScore = eloToScore(newRatedUserElo)

      await tx.user.update({
        where: { id: photo.userId },
        data: {
          eloRating: newRatedUserElo,
          totalScore: newTotalScore,
          likeCount: newLikeCount,
          normalCount: newNormalCount,
          totalRatings: newTotalRatings,
          lastRatedAt: new Date()
        }
      })

      return {
        success: true,
        rating: {
          id: rating.id,
          type: rating.type,
          createdAt: rating.createdAt
        },
        eloChange,
        newScore: newTotalScore
      }
    })

    invalidateUserCache(numericRaterId)
    return result
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}


