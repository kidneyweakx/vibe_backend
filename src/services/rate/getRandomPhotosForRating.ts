import getPrisma from '../../dbConfig'
import { getPresignedGetUrl, getPublicObjectUrl } from '../r2/presign'
import {
  buildUserPreferenceProfile,
  scorePhotoForUser,
  type PhotoWithScore
} from '../../utils/recommendation'

declare global {
  interface Number {
    startsWith?(searchString: string, position?: number): boolean
  }
}

if (typeof (Number.prototype as any).startsWith !== 'function') {
  Object.defineProperty(Number.prototype, 'startsWith', {
    value(this: number, searchString: string, position?: number) {
      return String(this).startsWith(searchString, position)
    },
    enumerable: false,
    configurable: true,
    writable: true
  })
}

const REQUEST_LOCK_TTL = 15_000
const REPORTED_CACHE_TTL = 60_000
const RECENTLY_SEEN_TTL = 60_000

const requestQueue = new Map<string, { promise: Promise<any>; expiresAt: number }>()

interface ReportedCacheEntry {
  ids: string[]
  expiresAt: number
}

let reportedPhotosCache: ReportedCacheEntry | null = null

interface RecentlySeenEntry {
  seen: Map<string, number>
}

const recentlySeenCache = new Map<string, RecentlySeenEntry>()

// Create logger for this module
const logger = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [GetRandomPhotos] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  warn: (message: string, data?: any) => {
    const timestamp = new Date().toISOString()
    console.warn(`[${timestamp}] [GetRandomPhotos] WARN: ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [GetRandomPhotos] ERROR: ${message}`, error ? JSON.stringify(error, null, 2) : '')
  }
}

export async function getRandomPhotosForRating(userId: number | string, limit: number = 10) {
  const startTime = Date.now()
  const numericUserId = typeof userId === 'number' ? userId : Number(userId)
  if (!Number.isFinite(numericUserId)) {
    throw new Error('Invalid user identifier')
  }

  const cacheKey = String(numericUserId)
  const requestKey = `random-photos-${cacheKey}-${limit}`

  const existing = requestQueue.get(requestKey)
  if (existing && existing.expiresAt > Date.now()) {
    logger.info('Request already in progress, waiting for result', { userId: cacheKey, limit })
    return await existing.promise
  }

  const requestPromise = executeRandomPhotosRequest(numericUserId, cacheKey, limit, startTime)
  requestQueue.set(requestKey, { promise: requestPromise, expiresAt: Date.now() + REQUEST_LOCK_TTL })

  try {
    return await requestPromise
  } finally {
    requestQueue.delete(requestKey)
  }
}

async function executeRandomPhotosRequest(userId: number, userKey: string, limit: number, startTime: number) {
  logger.info('Starting recommendation-based photo fetch', { userId: userKey, limit })

  try {
    const prisma = getPrisma()
    const dbTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout after 10 seconds')), 10000)
    })

    logger.info('Building user preference profile')
    const [userRatings, reportedPhotoIds] = await Promise.all([
      prisma.rating.findMany({
        where: { raterId: userId },
        include: {
          ratedUser: true,
          photo: {
            include: {
              photoTags: {
                include: { tag: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      }),
      getReportedPhotoIds(prisma)
    ])

    const userProfile = buildUserPreferenceProfile(userKey, userRatings as any)
    const isNewUser = userProfile.totalRatings === 0

    logger.info('User preference profile built', {
      totalRatings: userProfile.totalRatings,
      likeRate: userProfile.likeRate,
      preferredGenders: Array.from(userProfile.preferredGenders.keys()),
      preferredTagCount: userProfile.preferredTags.size,
      isNewUser
    })

    const recentlySeen = getRecentlySeen(userKey)
    pruneExpiredSeen(recentlySeen)
    const recentlySeenSet = new Set(recentlySeen.keys())

    const ratedPhotoIds = userRatings.map((r) => r.photoId)

    const dbQueryPromise = prisma.photo.findMany({
      where: {
        user: {
          isGuest: false,
          provider: { not: 'guest' },
          providerId: { not: { startsWith: 'guest_' } }
        },
        userId: { not: userId },
        isProfilePicture: false,
        status: 'active',
        id: { notIn: [...reportedPhotoIds, ...ratedPhotoIds] }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            gender: true,
            eloRating: true,
            totalScore: true,
            isGuest: true,
            providerId: true
          }
        },
        photoTags: {
          include: { tag: true }
        },
        _count: {
          select: { ratings: true }
        }
      },
      take: limit * 10 // Get more candidates for better recommendation
    })

    const candidates = await Promise.race([dbQueryPromise, dbTimeoutPromise])

    logger.info('Photos query completed', {
      foundCount: candidates.length,
      requestedMultiplier: limit * 10
    })

    // For new users, use simple random selection for better cold-start experience
    // For existing users, use recommendation algorithm
    let topPhotos: PhotoWithScore[]

    if (isNewUser && candidates.length > 0) {
      // Simple random shuffle for new users
      const shuffled = [...candidates].sort(() => 0.5 - Math.random())
      topPhotos = shuffled.slice(0, limit).map(photo => ({
        photoId: photo.id,
        score: 0.5, // Neutral score
        reasons: ['new_user_random']
      }))

      logger.info('New user: using random selection', {
        totalCandidates: candidates.length,
        selectedCount: topPhotos.length
      })
    } else {
      // Score all candidates using recommendation algorithm
      const scoredPhotos: PhotoWithScore[] = []
      for (const photo of candidates) {
      const scored = scorePhotoForUser(
          photo,
          userProfile,
        recentlySeenSet,
          photo._count.ratings
        )
        scoredPhotos.push(scored)
      }

      // Sort by score and select top N
      scoredPhotos.sort((a, b) => b.score - a.score)
      topPhotos = scoredPhotos.slice(0, limit)

      logger.info('Recommendation scoring completed', {
        totalCandidates: candidates.length,
        selectedCount: topPhotos.length,
        topScores: topPhotos.slice(0, 5).map(p => ({ photoId: p.photoId, score: p.score, reasons: p.reasons }))
      })
    }

    // Update recently seen cache
    const selectedUserIds = topPhotos
      .map((p) => {
        const match = candidates.find((c) => c.id === p.photoId)
        return match?.userId ? String(match.userId) : null
      })
      .filter((id): id is string => Boolean(id))

    updateRecentlySeen(recentlySeen, selectedUserIds)

    // Get full photo objects and generate presigned URLs
    logger.info('Generating presigned URLs for selected photos')
    const selected = topPhotos
      .map((score) => candidates.find((c) => c.id === score.photoId))
      .filter(Boolean) as typeof candidates

    const signedResults = await Promise.allSettled(
      selected.map(async (photo, index) => {
        const signedUrl = await getPresignedGetUrl(photo.key, 60 * 60 * 24 * 7)
        logger.info(`Generated presigned URL for photo ${index + 1}/${selected.length}`, {
          photoId: photo.id,
          userId: photo.userId,
          key: photo.key,
          score: topPhotos[index]?.score,
          reasons: topPhotos[index]?.reasons
        })
        return { ...photo, url: signedUrl }
      })
    )

    const withSignedUrl = signedResults.map((result, index) => {
      if (result.status === 'fulfilled') return result.value

      const fallbackPhoto = selected[index]
      logger.error(`Failed to generate presigned URL for photo ${index + 1}`, {
        photoId: fallbackPhoto.id,
        key: fallbackPhoto.key,
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
      })
      return {
        ...fallbackPhoto,
        url: getPublicObjectUrl(fallbackPhoto.key)
      }
    })

    const normalizedResults = withSignedUrl.map((photo) => {
      const normalizedUserId = photo.user?.isGuest && photo.user.providerId
        ? photo.user.providerId
        : photo.userId

      return {
        ...photo,
        userId: normalizedUserId,
        user: photo.user
          ? {
              ...photo.user,
              id: photo.user.id
            }
          : photo.user
      }
    })

    const uniqueResults = [] as typeof normalizedResults
    const seenUsers = new Set<string>()
    for (const photo of normalizedResults) {
      const dedupeKey = typeof photo.userId === 'string' ? photo.userId : String(photo.userId)
      if (seenUsers.has(dedupeKey)) continue
      seenUsers.add(dedupeKey)
      uniqueResults.push(photo)
      if (uniqueResults.length >= limit) break
    }

    const duration = Date.now() - startTime
    logger.info('Recommendation-based photo fetch completed successfully', {
      userId: userKey,
      limit,
      finalCount: uniqueResults.length,
      duration: `${duration}ms`,
      photoIds: uniqueResults.map(p => p.id)
    })

    return uniqueResults
  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error('Recommendation-based photo fetch failed', {
      userId: userKey,
      limit,
      duration: `${duration}ms`,
      error: error.message,
      stack: error.stack,
      code: error.code
    })
    throw error
  }
}

async function getReportedPhotoIds(prisma: ReturnType<typeof getPrisma>) {
  if (reportedPhotosCache && reportedPhotosCache.expiresAt > Date.now()) {
    return reportedPhotosCache.ids
  }

  const reported = await prisma.$queryRaw<Array<{ photoId: string }>>`
    SELECT photoId
    FROM reports
    GROUP BY photoId
    HAVING COUNT(*) >= 2
  `

  const ids = reported.map((row) => row.photoId)
  reportedPhotosCache = {
    ids,
    expiresAt: Date.now() + REPORTED_CACHE_TTL
  }

  return ids
}

function getRecentlySeen(userId: string) {
  let entry = recentlySeenCache.get(userId)
  if (!entry) {
    entry = { seen: new Map<string, number>() }
    recentlySeenCache.set(userId, entry)
  }
  return entry.seen
}

function pruneExpiredSeen(seen: Map<string, number>) {
  const now = Date.now()
  for (const [key, timestamp] of seen.entries()) {
    if (now - timestamp > RECENTLY_SEEN_TTL) {
      seen.delete(key)
    }
  }
}

function updateRecentlySeen(seen: Map<string, number>, userIds: string[]) {
  const now = Date.now()
  for (const id of userIds) {
    seen.set(id, now)
  }

  if (seen.size <= 50) return

  const ordered = Array.from(seen.entries()).sort((a, b) => a[1] - b[1])
  while (ordered.length > 50) {
    const [oldest] = ordered.shift()!
    seen.delete(oldest)
  }
}

export function clearRandomPhotoCaches() {
  requestQueue.clear()
  recentlySeenCache.clear()
  reportedPhotosCache = null
}


