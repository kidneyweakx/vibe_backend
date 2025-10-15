import getPrisma from '../../dbConfig'

const JOURNEY_CACHE_TTL = 30_000

interface CacheEntry<T> {
  expiresAt: number
  data: T
}

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
  // NEW: Weekly progress data
  weeklyProgress: WeeklyProgress
}

export interface WeeklyProgress {
  currentWeekScore: number
  lastWeekScore: number
  scoreChange: number
  currentWeekRatings: number
  lastWeekRatings: number
  rankChange: number // Positive = improved, negative = dropped
  femaleAttractionChange: number
  maleAttractionChange: number
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

const journeyCache = new Map<string, CacheEntry<JourneyDashboard>>()

export async function getJourneyDashboard(userId: string): Promise<JourneyDashboard> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('User not found')
  }

  const cached = journeyCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  const prisma = getPrisma()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      gender: true,
      eloRating: true,
      totalScore: true,
      likeCount: true,
      normalCount: true,
      totalRatings: true
    }
  })

  if (!user) {
    throw new Error('User not found')
  }

  const today = startOfDay(new Date())
  const currentWeekStart = daysAgo(today, 6)
  const previousWeekStart = daysAgo(today, 13)

  const [
    overallHigherCount,
    genderHigherCount,
    totalUsersResult,
    genderTotalsRows,
    weeklyRows,
    genderWindowRows,
    recentRatings
  ] = await Promise.all([
    prisma.user.count({
      where: {
        isGuest: false,
        eloRating: { gt: user.eloRating }
      }
    }),
    user.gender
      ? prisma.user.count({
          where: {
            isGuest: false,
            gender: user.gender,
            eloRating: { gt: user.eloRating }
          }
        })
      : Promise.resolve<number | null>(null),
    prisma.user.count({ where: { isGuest: false } }),
    prisma.$queryRaw<Array<{ gender: string | null; type: string; count: number | bigint }>>`
      SELECT u.gender as gender, r.type as type, COUNT(*) as count
      FROM ratings r
      LEFT JOIN users u ON u.id = r.raterId
      WHERE r.ratedUserId = ${userId}
      GROUP BY u.gender, r.type
    `,
    prisma.$queryRaw<Array<{ date: string; likeCount: number | bigint; normalCount: number | bigint; totalCount: number | bigint }>>`
      SELECT
        strftime('%Y-%m-%d', createdAt) as date,
        SUM(CASE WHEN type = 'like' THEN 1 ELSE 0 END) as likeCount,
        SUM(CASE WHEN type = 'normal' THEN 1 ELSE 0 END) as normalCount,
        COUNT(*) as totalCount
      FROM ratings
      WHERE ratedUserId = ${userId}
        AND createdAt >= ${previousWeekStart.toISOString()}
      GROUP BY strftime('%Y-%m-%d', createdAt)
    `,
    prisma.$queryRaw<Array<{ date: string; gender: string | null; type: string; count: number | bigint }>>`
      SELECT
        strftime('%Y-%m-%d', r.createdAt) as date,
        u.gender as gender,
        r.type as type,
        COUNT(*) as count
      FROM ratings r
      LEFT JOIN users u ON u.id = r.raterId
      WHERE r.ratedUserId = ${userId}
        AND r.createdAt >= ${previousWeekStart.toISOString()}
      GROUP BY strftime('%Y-%m-%d', r.createdAt), u.gender, r.type
    `,
    prisma.rating.findMany({
      where: { ratedUserId: userId },
      include: {
        rater: {
          select: { name: true, gender: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
  ])

  const overallRank = overallHigherCount + 1
  const genderRank = user.gender ? (genderHigherCount ?? 0) + 1 : null

  const genderTotals = summariseGenderTotals(genderTotalsRows)
  const femaleAttraction = calculateAttraction(genderTotals.female.like, genderTotals.female.normal)
  const maleAttraction = calculateAttraction(genderTotals.male.like, genderTotals.male.normal)

  const weeklyTrend = buildWeeklyTrend(weeklyRows, today)
  const lastWeekTrend = buildWeeklyTrend(weeklyRows, daysAgo(today, 7), 7)

  const weeklyProgress = calculateWeeklyProgress(
    weeklyTrend,
    lastWeekTrend,
    genderWindowRows,
    currentWeekStart,
    previousWeekStart,
    femaleAttraction,
    maleAttraction
  )

  const dashboard: JourneyDashboard = {
    userId: user.id,
    totalScore: user.totalScore,
    likeCount: user.likeCount,
    normalCount: user.normalCount,
    totalRatings: user.totalRatings,
    overallRank,
    genderRank,
    totalUsers: totalUsersResult,
    femaleAttraction,
    maleAttraction,
    recentRatings: recentRatings.map((r) => ({
      id: r.id,
      type: r.type,
      createdAt: r.createdAt,
      raterName: r.rater?.name ?? null,
      raterGender: r.rater?.gender ?? null
    })),
    weeklyTrend,
    achievements: generateAchievements(user.totalRatings, user.likeCount, user.totalScore),
    nextMilestone: generateNextMilestone(user.totalRatings, user.likeCount),
    levelProgress: calculateLevelProgress(user.totalScore),
    weeklyProgress
  }

  journeyCache.set(userId, {
    expiresAt: Date.now() + JOURNEY_CACHE_TTL,
    data: dashboard
  })

  return dashboard
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function daysAgo(from: Date, days: number): Date {
  const copy = new Date(from)
  copy.setDate(copy.getDate() - days)
  return copy
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface GenderSummary {
  like: number
  normal: number
}

function summariseGenderTotals(rows: Array<{ gender: string | null; type: string; count: number | bigint }>) {
  const summary: Record<'female' | 'male', GenderSummary> = {
    female: { like: 0, normal: 0 },
    male: { like: 0, normal: 0 }
  }

  for (const row of rows) {
    const gender = row.gender === 'female' ? 'female' : row.gender === 'male' ? 'male' : null
    if (!gender) continue
    const type = row.type === 'like' ? 'like' : row.type === 'normal' ? 'normal' : null
    if (!type) continue
    summary[gender][type] += Number(row.count)
  }

  return summary
}

function buildWeeklyTrend(
  rows: Array<{ date: string; likeCount: number | bigint; normalCount: number | bigint; totalCount: number | bigint }>,
  endDate: Date,
  window: number = 7
): DailyScore[] {
  const map = new Map<string, { like: number; normal: number; total: number }>()
  for (const row of rows) {
    map.set(row.date, {
      like: Number(row.likeCount ?? 0),
      normal: Number(row.normalCount ?? 0),
      total: Number(row.totalCount ?? 0)
    })
  }

  const result: DailyScore[] = []
  for (let i = window - 1; i >= 0; i--) {
    const currentDate = daysAgo(endDate, i)
    const key = formatDateKey(currentDate)
    const stats = map.get(key) ?? { like: 0, normal: 0, total: 0 }
    const score = stats.total > 0 ? roundScore((stats.like * 1 + stats.normal * 0.2) / stats.total) : 0
    result.push({
      date: key,
      score,
      ratingCount: stats.total
    })
  }

  return result
}

function roundScore(value: number): number {
  return Math.round(value * 10000) / 100
}

function calculateAttraction(like: number, normal: number): number {
  const total = like + normal
  if (total === 0) return 0
  return Math.round(((like * 1 + normal * 0.2) / total) * 1000) / 10
}

function calculateWeeklyProgress(
  currentWeekTrend: DailyScore[],
  previousWeekTrend: DailyScore[],
  genderWindowRows: Array<{ date: string; gender: string | null; type: string; count: number | bigint }>,
  currentWeekStart: Date,
  previousWeekStart: Date,
  currentFemaleAttraction: number,
  currentMaleAttraction: number
): WeeklyProgress {
  const currentWeekScore = averageScore(currentWeekTrend)
  const lastWeekScore = averageScore(previousWeekTrend)
  const currentWeekRatings = sumRatings(currentWeekTrend)
  const lastWeekRatings = sumRatings(previousWeekTrend)

  const genderBuckets = splitGenderWindow(genderWindowRows, currentWeekStart, previousWeekStart)
  const lastWeekFemaleAttraction = calculateAttraction(genderBuckets.previous.female.like, genderBuckets.previous.female.normal)
  const lastWeekMaleAttraction = calculateAttraction(genderBuckets.previous.male.like, genderBuckets.previous.male.normal)

  const scoreChange = Math.round((currentWeekScore - lastWeekScore) * 10) / 10
  const rankChange = scoreChange > 0 ? Math.ceil(scoreChange * 2) : Math.floor(scoreChange * 2)

  return {
    currentWeekScore: Math.round(currentWeekScore * 10) / 10,
    lastWeekScore: Math.round(lastWeekScore * 10) / 10,
    scoreChange,
    currentWeekRatings,
    lastWeekRatings,
    rankChange,
    femaleAttractionChange: Math.round((currentFemaleAttraction - lastWeekFemaleAttraction) * 10) / 10,
    maleAttractionChange: Math.round((currentMaleAttraction - lastWeekMaleAttraction) * 10) / 10
  }
}

function averageScore(trend: DailyScore[]): number {
  const daysWithRatings = trend.filter((day) => day.ratingCount > 0)
  if (daysWithRatings.length === 0) return 0
  return daysWithRatings.reduce((sum, day) => sum + day.score, 0) / daysWithRatings.length
}

function sumRatings(trend: DailyScore[]): number {
  return trend.reduce((sum, day) => sum + day.ratingCount, 0)
}

function splitGenderWindow(
  rows: Array<{ date: string; gender: string | null; type: string; count: number | bigint }>,
  currentWeekStart: Date,
  previousWeekStart: Date
) {
  const buckets = {
    current: {
      female: { like: 0, normal: 0 },
      male: { like: 0, normal: 0 }
    },
    previous: {
      female: { like: 0, normal: 0 },
      male: { like: 0, normal: 0 }
    }
  }

  const currentStartKey = formatDateKey(currentWeekStart)
  const previousStartKey = formatDateKey(previousWeekStart)

  for (const row of rows) {
    const gender = row.gender === 'female' ? 'female' : row.gender === 'male' ? 'male' : null
    if (!gender) continue
    const type = row.type === 'like' ? 'like' : row.type === 'normal' ? 'normal' : null
    if (!type) continue

    if (row.date >= currentStartKey) {
      buckets.current[gender][type] += Number(row.count)
    } else if (row.date >= previousStartKey) {
      buckets.previous[gender][type] += Number(row.count)
    }
  }

  return buckets
}

export function clearJourneyCache() {
  journeyCache.clear()
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
