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
  
  // Single optimized query to get all user statistics and rankings
  const userStats = await prisma.$queryRaw<Array<{
    userId: string
    name: string | null
    gender: string | null
    likeCount: bigint
    normalCount: bigint
    totalRatings: bigint
    totalScore: number
    overallRank: bigint
    genderRank: bigint | null
    totalUsers: bigint
    femaleLikeCount: bigint
    maleLikeCount: bigint
    femaleNormalCount: bigint
    maleNormalCount: bigint
  }>>`
    WITH user_stats AS (
      SELECT 
        u.id as userId,
        u.name,
        u.gender,
        COALESCE(like_stats.likeCount, 0) as likeCount,
        COALESCE(normal_stats.normalCount, 0) as normalCount,
        COALESCE(like_stats.likeCount, 0) + COALESCE(normal_stats.normalCount, 0) as totalRatings,
        CASE 
          WHEN COALESCE(like_stats.likeCount, 0) + COALESCE(normal_stats.normalCount, 0) = 0 THEN 0
          ELSE ROUND(
            ((COALESCE(like_stats.likeCount, 0) * 1.0 + COALESCE(normal_stats.normalCount, 0) * 0.2) / 
             (COALESCE(like_stats.likeCount, 0) + COALESCE(normal_stats.normalCount, 0))) * 100
          )
        END as totalScore
      FROM users u
      LEFT JOIN (
        SELECT ratedUserId, COUNT(*) as likeCount
        FROM ratings 
        WHERE type = 'like' AND ratedUserId NOT LIKE 'guest%'
        GROUP BY ratedUserId
      ) like_stats ON u.id = like_stats.ratedUserId
      LEFT JOIN (
        SELECT ratedUserId, COUNT(*) as normalCount
        FROM ratings 
        WHERE type = 'normal' AND ratedUserId NOT LIKE 'guest%'
        GROUP BY ratedUserId
      ) normal_stats ON u.id = normal_stats.ratedUserId
      WHERE u.id = ${userId}
    ),
    rankings AS (
      SELECT 
        us.*,
        ROW_NUMBER() OVER (ORDER BY us.totalScore DESC) as overallRank,
        ROW_NUMBER() OVER (PARTITION BY us.gender ORDER BY us.totalScore DESC) as genderRank,
        (SELECT COUNT(*) FROM users WHERE id NOT LIKE 'guest%') as totalUsers
      FROM user_stats us
    ),
    gender_attraction AS (
      SELECT 
        r.*,
        COALESCE(female_likes.likeCount, 0) as femaleLikeCount,
        COALESCE(male_likes.likeCount, 0) as maleLikeCount,
        COALESCE(female_normals.normalCount, 0) as femaleNormalCount,
        COALESCE(male_normals.normalCount, 0) as maleNormalCount
      FROM rankings r
      LEFT JOIN (
        SELECT 
          r.ratedUserId,
          COUNT(*) as likeCount
        FROM ratings r
        JOIN users u ON r.raterId = u.id
        WHERE r.type = 'like' AND u.gender = 'female' AND r.ratedUserId = ${userId}
        GROUP BY r.ratedUserId
      ) female_likes ON r.userId = female_likes.ratedUserId
      LEFT JOIN (
        SELECT 
          r.ratedUserId,
          COUNT(*) as likeCount
        FROM ratings r
        JOIN users u ON r.raterId = u.id
        WHERE r.type = 'like' AND u.gender = 'male' AND r.ratedUserId = ${userId}
        GROUP BY r.ratedUserId
      ) male_likes ON r.userId = male_likes.ratedUserId
      LEFT JOIN (
        SELECT 
          r.ratedUserId,
          COUNT(*) as normalCount
        FROM ratings r
        JOIN users u ON r.raterId = u.id
        WHERE r.type = 'normal' AND u.gender = 'female' AND r.ratedUserId = ${userId}
        GROUP BY r.ratedUserId
      ) female_normals ON r.userId = female_normals.ratedUserId
      LEFT JOIN (
        SELECT 
          r.ratedUserId,
          COUNT(*) as normalCount
        FROM ratings r
        JOIN users u ON r.raterId = u.id
        WHERE r.type = 'normal' AND u.gender = 'male' AND r.ratedUserId = ${userId}
        GROUP BY r.ratedUserId
      ) male_normals ON r.userId = male_normals.ratedUserId
    )
    SELECT * FROM gender_attraction
  `

  if (userStats.length === 0) {
    throw new Error('User not found')
  }

  const stats = userStats[0]
  
  // Calculate gender attraction scores
  const femaleTotal = Number(stats.femaleLikeCount) + Number(stats.femaleNormalCount)
  const maleTotal = Number(stats.maleLikeCount) + Number(stats.maleNormalCount)
  
  const femaleAttraction = femaleTotal > 0 
    ? ((Number(stats.femaleLikeCount) * 1.0 + Number(stats.femaleNormalCount) * 0.2) / femaleTotal) * 100
    : 0
    
  const maleAttraction = maleTotal > 0
    ? ((Number(stats.maleLikeCount) * 1.0 + Number(stats.maleNormalCount) * 0.2) / maleTotal) * 100
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

  // Get weekly trend (last 7 days)
  const weeklyTrend = await prisma.$queryRaw<Array<{
    date: string
    score: number
    ratingCount: bigint
  }>>`
    WITH date_series AS (
      SELECT date('now', '-' || (row_number() OVER (ORDER BY 1) - 1) || ' days') as date
      FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7)
    ),
    daily_ratings AS (
      SELECT 
        DATE(r.createdAt) as date,
        COUNT(CASE WHEN r.type = 'like' THEN 1 END) as likeCount,
        COUNT(CASE WHEN r.type = 'normal' THEN 1 END) as normalCount,
        COUNT(*) as ratingCount
      FROM ratings r
      WHERE r.ratedUserId = ${userId}
        AND DATE(r.createdAt) >= date('now', '-7 days')
      GROUP BY DATE(r.createdAt)
    )
    SELECT 
      ds.date,
      CASE 
        WHEN dr.ratingCount = 0 THEN 0
        ELSE ROUND(((dr.likeCount * 1.0 + dr.normalCount * 0.2) / dr.ratingCount) * 100, 2)
      END as score,
      COALESCE(dr.ratingCount, 0) as ratingCount
    FROM date_series ds
    LEFT JOIN daily_ratings dr ON ds.date = dr.date
    ORDER BY ds.date
  `

  // Generate achievements based on user stats
  const achievements = generateAchievements(Number(stats.totalRatings), Number(stats.likeCount), Number(stats.totalScore))
  
  // Generate next milestone
  const nextMilestone = generateNextMilestone(Number(stats.totalRatings), Number(stats.likeCount))
  
  // Calculate level progress
  const levelProgress = calculateLevelProgress(Number(stats.totalScore))

  return {
    userId: stats.userId,
    totalScore: Number(stats.totalScore),
    likeCount: Number(stats.likeCount),
    normalCount: Number(stats.normalCount),
    totalRatings: Number(stats.totalRatings),
    overallRank: Number(stats.overallRank),
    genderRank: stats.genderRank ? Number(stats.genderRank) : null,
    totalUsers: Number(stats.totalUsers),
    femaleAttraction,
    maleAttraction,
    recentRatings: recentRatings.map(r => ({
      id: r.id,
      type: r.type,
      createdAt: r.createdAt,
      raterName: r.rater.name,
      raterGender: r.rater.gender
    })),
    weeklyTrend: weeklyTrend.map(t => ({
      date: t.date,
      score: t.score,
      ratingCount: Number(t.ratingCount)
    })),
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
