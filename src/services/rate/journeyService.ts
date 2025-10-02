import getPrisma from '../../dbConfig'
import { getPresignedGetUrl } from '../r2/presign'

export interface JourneyDashboard {
  userId: string
  totalScore: number
  likeCount: number
  normalCount: number
  totalRatings: number
  overallRank: number
  genderRank: number | null
  totalUsers: number
  femaleAttraction: number
  maleAttraction: number
  recentRatings: RecentRating[]
  weeklyTrend: DailyScore[]
  achievements: Achievement[]
  nextMilestone: Milestone | null
  levelProgress: LevelProgress
}

export interface RecentRating {
  id: string
  type: string
  createdAt: Date
  raterName: string | null
  raterGender: string | null
}

export interface DailyScore {
  date: string
  score: number
  ratingCount: number
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlockedAt: Date | null
  progress: number
}

export interface Milestone {
  title: string
  description: string
  targetValue: number
  currentValue: number
  reward: string
}

export interface LevelProgress {
  currentLevel: number
  currentScore: number
  nextLevelThreshold: number
  progressPercentage: number
}

export async function getJourneyDashboard(userId: string): Promise<JourneyDashboard> {
  const prisma = getPrisma()
  
  // Get basic user info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, gender: true }
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Get user's rating counts
  const [likeCount, normalCount] = await Promise.all([
    prisma.rating.count({
      where: { 
        ratedUserId: userId,
        type: 'like'
      }
    }),
    prisma.rating.count({
      where: { 
        ratedUserId: userId,
        type: 'normal'
      }
    })
  ])

  const totalRatings = likeCount + normalCount
  const totalScore = totalRatings > 0 
    ? Math.round(((likeCount * 1.0 + normalCount * 0.2) / totalRatings) * 100)
    : 0

  // Get overall ranking (excluding guest users)
  const overallRankResult = await prisma.$queryRaw<Array<{ rank: bigint }>>`
    SELECT COUNT(*) + 1 as rank
    FROM users u
    LEFT JOIN (
      SELECT
        ratedUserId,
        COUNT(CASE WHEN type = 'like' THEN 1 END) as likeCount,
        COUNT(CASE WHEN type = 'normal' THEN 1 END) as normalCount
      FROM ratings
      GROUP BY ratedUserId
    ) r ON u.id = r.ratedUserId
    WHERE u.id != ${userId}
      AND u.isGuest = 0
      AND (
        CASE
          WHEN COALESCE(r.likeCount, 0) + COALESCE(r.normalCount, 0) = 0 THEN 0
          ELSE ROUND(
            ((COALESCE(r.likeCount, 0) * 1.0 + COALESCE(r.normalCount, 0) * 0.2) /
             (COALESCE(r.likeCount, 0) + COALESCE(r.normalCount, 0))) * 100
          )
        END
      ) > ${totalScore}
  `

  // Get gender ranking (excluding guest users)
  const genderRankResult = user.gender ? await prisma.$queryRaw<Array<{ rank: bigint }>>`
    SELECT COUNT(*) + 1 as rank
    FROM users u
    LEFT JOIN (
      SELECT
        ratedUserId,
        COUNT(CASE WHEN type = 'like' THEN 1 END) as likeCount,
        COUNT(CASE WHEN type = 'normal' THEN 1 END) as normalCount
      FROM ratings
      GROUP BY ratedUserId
    ) r ON u.id = r.ratedUserId
    WHERE u.id != ${userId}
      AND u.isGuest = 0
      AND u.gender = ${user.gender}
      AND (
        CASE
          WHEN COALESCE(r.likeCount, 0) + COALESCE(r.normalCount, 0) = 0 THEN 0
          ELSE ROUND(
            ((COALESCE(r.likeCount, 0) * 1.0 + COALESCE(r.normalCount, 0) * 0.2) /
             (COALESCE(r.likeCount, 0) + COALESCE(r.normalCount, 0))) * 100
          )
        END
      ) > ${totalScore}
  ` : [{ rank: BigInt(0) }]

  // Get total user count (excluding guest users)
  const totalUsersResult = await prisma.user.count({ where: { isGuest: false } })

  // Get gender-specific attraction data
  const [femaleLikeCount, maleLikeCount, femaleNormalCount, maleNormalCount] = await Promise.all([
    prisma.rating.count({
      where: {
        ratedUserId: userId,
        type: 'like',
        rater: { gender: 'female' }
      }
    }),
    prisma.rating.count({
      where: {
        ratedUserId: userId,
        type: 'like',
        rater: { gender: 'male' }
      }
    }),
    prisma.rating.count({
      where: {
        ratedUserId: userId,
        type: 'normal',
        rater: { gender: 'female' }
      }
    }),
    prisma.rating.count({
      where: {
        ratedUserId: userId,
        type: 'normal',
        rater: { gender: 'male' }
      }
    })
  ])

  const overallRank = Number(overallRankResult[0]?.rank || 1)
  const genderRank = user.gender ? Number(genderRankResult[0]?.rank || 1) : null
  
  // Calculate gender attraction scores
  const femaleTotal = femaleLikeCount + femaleNormalCount
  const maleTotal = maleLikeCount + maleNormalCount
  
  const femaleAttraction = femaleTotal > 0 
    ? ((femaleLikeCount * 1.0 + femaleNormalCount * 0.2) / femaleTotal) * 100
    : 0
    
  const maleAttraction = maleTotal > 0
    ? ((maleLikeCount * 1.0 + maleNormalCount * 0.2) / maleTotal) * 100
    : 0

  // Get recent ratings (last 10)
  const recentRatings = await prisma.rating.findMany({
    where: { ratedUserId: userId },
    include: {
      rater: {
        select: { name: true, gender: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  // Get weekly trend (last 7 days) - simplified approach
  const weeklyTrend: DailyScore[] = []
  const today = new Date()
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    
    // Get ratings for this specific date
    const dayRatings = await prisma.rating.findMany({
      where: {
        ratedUserId: userId,
        createdAt: {
          gte: new Date(dateStr + 'T00:00:00.000Z'),
          lt: new Date(dateStr + 'T23:59:59.999Z')
        }
      }
    })
    
    const likeCount = dayRatings.filter(r => r.type === 'like').length
    const normalCount = dayRatings.filter(r => r.type === 'normal').length
    const totalCount = dayRatings.length
    
    const score = totalCount > 0 
      ? Math.round(((likeCount * 1.0 + normalCount * 0.2) / totalCount) * 100 * 100) / 100
      : 0
    
    weeklyTrend.push({
      date: dateStr,
      score,
      ratingCount: totalCount
    })
  }

  // Generate achievements based on user stats
  const achievements = generateAchievements(totalRatings, likeCount, totalScore)
  
  // Generate next milestone
  const nextMilestone = generateNextMilestone(totalRatings, likeCount)
  
  // Calculate level progress
  const levelProgress = calculateLevelProgress(totalScore)

  return {
    userId: user.id,
    totalScore,
    likeCount,
    normalCount,
    totalRatings,
    overallRank,
    genderRank,
    totalUsers: totalUsersResult,
    femaleAttraction,
    maleAttraction,
    recentRatings: recentRatings.map(r => ({
      id: r.id,
      type: r.type,
      createdAt: r.createdAt,
      raterName: r.rater.name,
      raterGender: r.rater.gender
    })),
    weeklyTrend,
    achievements,
    nextMilestone,
    levelProgress
  }
}

function generateAchievements(totalRatings: number, likeCount: number, totalScore: number): Achievement[] {
  const achievements: Achievement[] = []
  
  // Rating milestones
  if (totalRatings >= 10) achievements.push({
    id: 'first_10_ratings',
    title: 'Getting Started',
    description: 'Received your first 10 ratings',
    icon: '🎯',
    unlockedAt: new Date(),
    progress: 1.0
  })
  
  if (totalRatings >= 50) achievements.push({
    id: 'rating_50',
    title: 'Popular Person',
    description: 'Received 50 ratings',
    icon: '⭐',
    unlockedAt: new Date(),
    progress: 1.0
  })
  
  if (totalRatings >= 100) achievements.push({
    id: 'rating_100',
    title: 'Rating Star',
    description: 'Received 100 ratings',
    icon: '🌟',
    unlockedAt: new Date(),
    progress: 1.0
  })
  
  // Like achievements
  if (likeCount >= 20) achievements.push({
    id: 'like_20',
    title: 'Heart Breaker',
    description: 'Received 20 likes',
    icon: '💖',
    unlockedAt: new Date(),
    progress: 1.0
  })
  
  // Score achievements
  if (totalScore >= 80) achievements.push({
    id: 'high_score_80',
    title: 'High Achiever',
    description: 'Achieved 80+ score',
    icon: '🏆',
    unlockedAt: new Date(),
    progress: 1.0
  })
  
  // Future achievements (locked)
  if (totalRatings < 200) achievements.push({
    id: 'rating_200',
    title: 'Rating Legend',
    description: 'Receive 200 ratings',
    icon: '👑',
    unlockedAt: null,
    progress: totalRatings / 200
  })
  
  return achievements
}

function generateNextMilestone(totalRatings: number, likeCount: number): Milestone | null {
  if (totalRatings < 50) {
    return {
      title: 'Reach 50 Ratings',
      description: 'Get 50 total ratings to unlock new features',
      targetValue: 50,
      currentValue: totalRatings,
      reward: 'Profile badge'
    }
  } else if (likeCount < 30) {
    return {
      title: 'Get 30 Likes',
      description: 'Receive 30 likes to boost your profile',
      targetValue: 30,
      currentValue: likeCount,
      reward: 'Special avatar frame'
    }
  } else if (totalRatings < 100) {
    return {
      title: 'Reach 100 Ratings',
      description: 'Achieve 100 total ratings milestone',
      targetValue: 100,
      currentValue: totalRatings,
      reward: 'Premium features access'
    }
  }
  
  return null
}

function calculateLevelProgress(totalScore: number): LevelProgress {
  const levels = [0, 20, 40, 60, 70, 80, 85, 90, 95, 98, 100]
  let currentLevel = 1
  
  for (let i = 1; i < levels.length; i++) {
    if (totalScore >= levels[i]) {
      currentLevel = i + 1
    } else {
      break
    }
  }
  
  const nextLevelThreshold = currentLevel < levels.length ? levels[currentLevel] : 100
  const progressPercentage = currentLevel < levels.length 
    ? ((totalScore - levels[currentLevel - 1]) / (nextLevelThreshold - levels[currentLevel - 1])) * 100
    : 100
  
  return {
    currentLevel: Math.min(currentLevel, 10),
    currentScore: totalScore,
    nextLevelThreshold,
    progressPercentage: Math.max(0, Math.min(100, progressPercentage))
  }
}
