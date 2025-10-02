import getPrisma from '../../dbConfig'
import { getPresignedGetUrl } from '../r2/presign'
import { calculateTotalScore } from './calculateTotalScore'

export async function getUserStats(userId: string) {
  const user = await getPrisma().user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  const likeCount = await getPrisma().rating.count({ where: { ratedUserId: userId, type: 'like' } })
  const normalCount = await getPrisma().rating.count({ where: { ratedUserId: userId, type: 'normal' } })
  const totalRatings = likeCount + normalCount
  const totalScore = calculateTotalScore(likeCount, normalCount)
  const allUserStats = await getPrisma().rating.groupBy({
    by: ['ratedUserId'],
    where: {
      type: { in: ['like', 'normal'] },
      ratedUser: { isGuest: false }
    },
    _count: { _all: true }
  })
  const userScores = await Promise.all(allUserStats.map(async (stat) => {
    const userLikes = await getPrisma().rating.count({ where: { ratedUserId: stat.ratedUserId, type: 'like' } })
    const userNormals = await getPrisma().rating.count({ where: { ratedUserId: stat.ratedUserId, type: 'normal' } })
    return { userId: stat.ratedUserId, score: calculateTotalScore(userLikes, userNormals) }
  }))
  const betterUsers = userScores.filter(u => u.score > totalScore)
  const overallRank = betterUsers.length + 1
  let genderRank: number | undefined
  if (user.gender) {
    const sameGenderUsers = await getPrisma().user.findMany({
      where: {
        gender: user.gender,
        isGuest: false
      },
      select: { id: true }
    })
    const sameGenderScores = userScores.filter(u => sameGenderUsers.some(sgu => sgu.id === u.userId))
    const betterSameGenderUsers = sameGenderScores.filter(u => u.score > totalScore)
    genderRank = betterSameGenderUsers.length + 1
  }
  const recentRatings = await getPrisma().rating.findMany({ where: { ratedUserId: userId }, include: { photo: true }, orderBy: { createdAt: 'desc' }, take: 10 })
  return {
    userId,
    totalScore,
    likeCount,
    normalCount,
    totalRatings,
    overallRank,
    genderRank,
    recentRatings: await Promise.all(recentRatings.map(async (rating) => ({
      photoId: rating.photoId,
      photoUrl: await getPresignedGetUrl(rating.photo.key, 60 * 60 * 24 * 7),
      type: rating.type,
      createdAt: rating.createdAt
    })))
  }
}


