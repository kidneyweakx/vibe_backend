import getPrisma from '../../dbConfig'
import { getPresignedGetUrl, getPublicObjectUrl } from '../r2/presign'
import {
  buildUserProfileV2,
  scorePhotoV2,
  optimizeForDiversity,
  recommendationCache,
  type PhotoScore
} from '../../utils/recommendationV2'
import type { Prisma } from '@prisma/client'

// Performance tuning
const REQUEST_LOCK_TTL = 15_000
const REPORTED_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const RECENTLY_SEEN_TTL = 2 * 60 * 1000 // 2 minutes
const QUERY_TIMEOUT = 5000 // 5 seconds

// Request deduplication
const requestQueue = new Map<string, { promise: Promise<any>; expiresAt: number }>()

// Recently seen tracking
interface RecentlySeenEntry {
  userIds: Set<string>
  photoIds: Set<string>
  lastUpdated: number
}
const recentlySeenCache = new Map<string, RecentlySeenEntry>()

// Reported photos cache
let reportedPhotosCache: { ids: Set<string>; expiresAt: number } | null = null

const logger = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [RandomPhotosV2] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [RandomPhotosV2] ERROR: ${message}`, error)
  }
}

/**
 * Main entry point for getting recommended photos
 */
export async function getRandomPhotosV2(userId: number | string, limit: number = 10): Promise<any[]> {
  const startTime = Date.now()
  const numericUserId = typeof userId === 'number' ? userId : Number(userId)
  
  if (!Number.isFinite(numericUserId)) {
    throw new Error('Invalid user identifier')
  }

  const requestKey = `photos-${numericUserId}-${limit}`
  
  // Check for existing request
  const existing = requestQueue.get(requestKey)
  if (existing && existing.expiresAt > Date.now()) {
    logger.info('Using existing request', { userId: numericUserId })
    return await existing.promise
  }

  // Create new request
  const requestPromise = executeRecommendationQuery(numericUserId, limit, startTime)
  requestQueue.set(requestKey, {
    promise: requestPromise,
    expiresAt: Date.now() + REQUEST_LOCK_TTL
  })

  try {
    return await requestPromise
  } finally {
    requestQueue.delete(requestKey)
  }
}

/**
 * Execute the recommendation query with optimizations
 */
async function executeRecommendationQuery(
  userId: number,
  limit: number,
  startTime: number
): Promise<any[]> {
  const prisma = getPrisma()
  
  try {
    // 1. Get user profile (cached if available)
    let userProfile = recommendationCache.getUserProfile(String(userId))
    
    if (!userProfile) {
      logger.info('Building user profile', { userId })
      
      // Parallel fetch user data
      const [userStats, userRatings] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            totalRatings: true,
            lastRatedAt: true,
            eloRating: true
          }
        }),
        prisma.rating.findMany({
          where: { raterId: userId },
          include: {
            ratedUser: {
              select: {
                id: true,
                gender: true,
                eloRating: true
              }
            },
            photo: {
              include: {
                photoTags: {
                  include: { tag: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50 // Limit for performance
        })
      ])
      
      if (!userStats) {
        throw new Error('User not found')
      }
      
      userProfile = buildUserProfileV2(String(userId), userRatings as any, userStats)
      recommendationCache.setUserProfile(String(userId), userProfile)
    }

    // 2. Get recently seen and reported photos
    const [recentlySeen, reportedIds] = await Promise.all([
      getRecentlySeen(String(userId)),
      getReportedPhotoIds(prisma)
    ])

    const ratedPhotoIds = Array.from(userProfile.ratedPhotoIds ?? new Set<string>())

    // 3. Build optimized query
    const excludePhotoIds = [
      ...Array.from(recentlySeen.photoIds),
      ...Array.from(reportedIds),
      ...ratedPhotoIds
    ]

    // Create query with smart candidate selection
    const candidateMultiplier = userProfile.isNewUser ? 5 : 3
    const candidateLimit = Math.min(limit * candidateMultiplier, 100)

    // Build where clause
    const whereClause: Prisma.PhotoWhereInput = {
      userId: { not: userId },
      status: 'active',
      isProfilePicture: false,
      id: excludePhotoIds.length > 0 ? { notIn: excludePhotoIds } : undefined,
      user: {
        isGuest: false,
        isDeleted: false
      }
    }

    // Add smart filtering based on user preferences
    if (!userProfile.isNewUser && userProfile.preferredGenders.size > 0) {
      const preferredGenders = Array.from(userProfile.preferredGenders.entries())
        .filter(([_, score]) => score > 0.3)
        .map(([gender]) => gender)
      
      if (preferredGenders.length > 0) {
        whereClause.user = {
          ...whereClause.user,
          gender: { in: preferredGenders }
        }
      }
    }

    // 4. Fetch candidates with timeout protection
    const queryPromise = prisma.photo.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            gender: true,
            eloRating: true,
            totalScore: true,
            isGuest: true
          }
        },
        photoTags: {
          include: { tag: true }
        },
        _count: {
          select: { ratings: true }
        }
      },
      orderBy: [
        { uploadedAt: 'desc' },
        { user: { eloRating: 'desc' } }
      ],
      take: candidateLimit
    })

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT)
    })

    const candidates = await Promise.race([queryPromise, timeoutPromise])

    logger.info('Candidates fetched', {
      userId,
      count: candidates.length,
      elapsed: Date.now() - startTime
    })

    // 5. Score and rank candidates
    const scoredPhotos: PhotoScore[] = []
    const recentUserIds = recentlySeen.userIds

    for (const photo of candidates) {
      const score = scorePhotoV2(photo as any, userProfile, recentUserIds)
      scoredPhotos.push(score)
    }

    // 6. Apply diversity optimization
    const optimized = optimizeForDiversity(
      scoredPhotos,
      candidates as any,
      limit
    )

    logger.info('Scoring complete', {
      userId,
      scoredCount: scoredPhotos.length,
      optimizedCount: optimized.length,
      topScores: optimized.slice(0, 3).map(s => ({
        score: s.score.toFixed(3),
        reasons: s.reasoning
      }))
    })

    // 7. Get final photos and generate URLs
    const selectedPhotos = optimized
      .map(score => candidates.find(c => c.id === score.photoId))
      .filter(Boolean)

    // Update recently seen
    updateRecentlySeen(
      String(userId),
      selectedPhotos.map(p => p!.user.id),
      selectedPhotos.map(p => p!.id)
    )

    // 8. Generate presigned URLs in parallel
    const withUrls = await Promise.all(
      selectedPhotos.map(async photo => {
        try {
          const url = await getPresignedGetUrl(photo!.key, 60 * 60 * 24 * 7)
          return { ...photo, url }
        } catch (error) {
          logger.error('Failed to generate presigned URL', {
            photoId: photo!.id,
            error
          })
          return { ...photo, url: getPublicObjectUrl(photo!.key) }
        }
      })
    )

    const duration = Date.now() - startTime
    logger.info('Recommendation complete', {
      userId,
      requested: limit,
      returned: withUrls.length,
      duration: `${duration}ms`
    })

    return withUrls
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Recommendation failed', {
      userId,
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : error
    })
    throw error
  }
}

/**
 * Get reported photo IDs with caching
 */
async function getReportedPhotoIds(prisma: ReturnType<typeof getPrisma>): Promise<Set<string>> {
  if (reportedPhotosCache && reportedPhotosCache.expiresAt > Date.now()) {
    return reportedPhotosCache.ids
  }

  try {
    const reported = await prisma.report.groupBy({
      by: ['photoId'],
      having: {
        photoId: {
          _count: {
            gte: 2
          }
        }
      },
      _count: {
        photoId: true
      }
    })

    const ids = new Set(reported.map(r => r.photoId))
    reportedPhotosCache = {
      ids,
      expiresAt: Date.now() + REPORTED_CACHE_TTL
    }

    return ids
  } catch (error) {
    logger.error('Failed to get reported photos', error)
    return new Set()
  }
}

/**
 * Get recently seen photos/users for a user
 */
function getRecentlySeen(userId: string): RecentlySeenEntry {
  let entry = recentlySeenCache.get(userId)
  
  if (!entry) {
    entry = {
      userIds: new Set(),
      photoIds: new Set(),
      lastUpdated: Date.now()
    }
    recentlySeenCache.set(userId, entry)
  }

  // Clean up old entries
  if (Date.now() - entry.lastUpdated > RECENTLY_SEEN_TTL) {
    entry.userIds.clear()
    entry.photoIds.clear()
    entry.lastUpdated = Date.now()
  }

  return entry
}

/**
 * Update recently seen tracking
 */
function updateRecentlySeen(
  userId: string,
  userIds: string[],
  photoIds: string[]
): void {
  const entry = getRecentlySeen(userId)
  
  // Add new items
  userIds.forEach(id => entry.userIds.add(id))
  photoIds.forEach(id => entry.photoIds.add(id))
  entry.lastUpdated = Date.now()

  // Limit size (keep most recent)
  if (entry.userIds.size > 50) {
    const toKeep = Array.from(entry.userIds).slice(-30)
    entry.userIds = new Set(toKeep)
  }

  if (entry.photoIds.size > 100) {
    const toKeep = Array.from(entry.photoIds).slice(-60)
    entry.photoIds = new Set(toKeep)
  }
}

/**
 * Clear all caches
 */
export function clearCaches(): void {
  requestQueue.clear()
  recentlySeenCache.clear()
  reportedPhotosCache = null
  recommendationCache.clear()
}

export function invalidateUserCache(userId: number | string): void {
  const key = String(userId)
  recommendationCache.invalidateUser(key)
  recentlySeenCache.delete(key)

  for (const requestKey of Array.from(requestQueue.keys())) {
    if (requestKey.startsWith(`photos-${key}-`)) {
      requestQueue.delete(requestKey)
    }
  }
}
