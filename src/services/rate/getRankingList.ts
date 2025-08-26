import getPrisma from '../../dbConfig'
import { calculateTotalScore } from './calculateTotalScore'

export async function getRankingList(limit: number = 50) {
  const allUserStats = await getPrisma().rating.groupBy({
    by: ['ratedUserId'],
    where: { type: { in: ['like', 'normal'] }, ratedUserId: { not: { startsWith: 'guest' } } },
    _count: { _all: true }
  })
  const userScores = await Promise.all(allUserStats.map(async (stat) => {
    const user = await getPrisma().user.findUnique({ where: { id: stat.ratedUserId } })
    const likeCount = await getPrisma().rating.count({ where: { ratedUserId: stat.ratedUserId, type: 'like' } })
    const normalCount = await getPrisma().rating.count({ where: { ratedUserId: stat.ratedUserId, type: 'normal' } })
    return {
      userId: stat.ratedUserId,
      name: user?.name || 'Unknown',
      avatar: user?.avatar ?? undefined,
      gender: user?.gender ?? undefined,
      totalScore: calculateTotalScore(likeCount, normalCount),
      likeCount,
      normalCount,
      totalRatings: likeCount + normalCount
    }
  }))
  userScores.sort((a, b) => b.totalScore - a.totalScore)
  const overallUsers = userScores.slice(0, limit).map((user, index) => ({ ...user, rank: index + 1 }))
  const maleUsers = userScores.filter(u => u.gender === 'male').slice(0, limit).map((u, i) => ({ ...u, rank: i + 1 }))
  const femaleUsers = userScores.filter(u => u.gender === 'female').slice(0, limit).map((u, i) => ({ ...u, rank: i + 1 }))
  const totalUsers = await getPrisma().user.count({ where: { id: { not: { startsWith: 'guest' } } } })
  return { overall: overallUsers, male: maleUsers, female: femaleUsers, totalUsers }
}


