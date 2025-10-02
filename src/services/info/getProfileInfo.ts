import getPrisma from '../../dbConfig'
import { getJourneyDashboard } from '../rate/journeyService'
import { getPresignedGetUrl } from '../r2/presign'
import type { PhotoListResponse, PhotoInfo } from '../interfaces/file'

// Updated interface to match actual return structure (line 122-148)
export interface ProfileInfoResponse {
  user: {
    id: string
    name: string | null
    avatar: string | undefined
    gender: string | null
    email: string | null
    provider: string | null
  }
  // Backend returns "stats" not "journey" (see return statement line 131)
  stats: {
    totalScore: number
    likeCount: number
    normalCount: number
    totalRatings: number
    overallRank: number
    genderRank: number | null
    totalUsers: number
    femaleAttraction: number
    maleAttraction: number
    recentRatings: any[]
    weeklyTrend: any[]
    achievements: any[]
    nextMilestone: any
    levelProgress: any
  }
  // Backend returns photos as array, not PhotoListResponse (see return statement line 147)
  photos: any[]
}

export async function getProfileInfo(userId: string, page: number = 1, limit: number = 20): Promise<ProfileInfoResponse> {
  const prisma = getPrisma()
  
  try {
    // Get user basic info first (fast query)
    const userData = await prisma.$queryRaw<Array<{
      userId: string
      name: string | null
      avatar: string | null
      gender: string | null
      email: string | null
      provider: string | null
      latestPhotoKey: string | null
      latestPhotoUrl: string | null
    }>>`
      SELECT
        u.id as userId,
        u.name,
        u.avatar,
        u.gender,
        u.email,
        u.provider,
        latest_photo.key as latestPhotoKey,
        latest_photo.url as latestPhotoUrl
      FROM users u
      LEFT JOIN (
        SELECT userId, key, url
        FROM photos p1
        WHERE isProfilePicture = 0
          AND uploadedAt = (
            SELECT MAX(uploadedAt)
            FROM photos p2
            WHERE p2.userId = p1.userId
              AND p2.isProfilePicture = 0
          )
      ) latest_photo ON u.id = latest_photo.userId
      WHERE u.id = ${userId}
    `

    if (userData.length === 0) {
      throw new Error('User not found')
    }

    const user = userData[0]
    
    // Generate avatar URL (prioritize profile picture over latest photo)
    let avatarUrl: string | undefined = undefined
    
    if (user.avatar) {
      try {
        avatarUrl = await getPresignedGetUrl(user.avatar, 60 * 60 * 24 * 7)
      } catch (error) {
        console.warn(`Failed to generate presigned URL for profile picture ${user.avatar}:`, error)
      }
    }
    
    if (!avatarUrl && user.latestPhotoKey) {
      try {
        avatarUrl = await getPresignedGetUrl(user.latestPhotoKey, 60 * 60 * 24 * 7)
      } catch (error) {
        console.warn(`Failed to generate presigned URL for latest photo ${user.latestPhotoKey}:`, error)
      }
    }

    // Get photos data and journey data in parallel (but with timeout protection)
    const [photosData, journeyData] = await Promise.allSettled([
      getUserPhotosOptimized(userId, page, limit),
      getJourneyDashboard(userId)
    ])

    const photos = photosData.status === 'fulfilled' ? photosData.value : { photos: [], totalCount: 0, hasMore: false }
    const journey = journeyData.status === 'fulfilled' ? journeyData.value : {
      totalScore: 0,
      likeCount: 0,
      normalCount: 0,
      totalRatings: 0,
      overallRank: 0,
      genderRank: null,
      totalUsers: 0,
      femaleAttraction: 0,
      maleAttraction: 0,
      recentRatings: [],
      weeklyTrend: [],
      achievements: [],
      nextMilestone: null,
      levelProgress: { currentLevel: 1, nextLevelThreshold: 100, progressPercentage: 0 }
    }

    return {
      user: {
        id: user.userId,
        name: user.name,
        avatar: avatarUrl,
        gender: user.gender,
        email: user.email,
        provider: user.provider
      },
      stats: {
        totalScore: journey.totalScore,
        likeCount: journey.likeCount,
        normalCount: journey.normalCount,
        totalRatings: journey.totalRatings,
        overallRank: journey.overallRank,
        genderRank: journey.genderRank,
        totalUsers: journey.totalUsers,
        femaleAttraction: journey.femaleAttraction,
        maleAttraction: journey.maleAttraction,
        recentRatings: journey.recentRatings,
        weeklyTrend: journey.weeklyTrend,
        achievements: journey.achievements,
        nextMilestone: journey.nextMilestone,
        levelProgress: journey.levelProgress
      },
      photos: photos.photos  // Return just the photos array, not the whole PhotoListResponse
    }
  } catch (error: any) {
    console.error('Profile info error:', error)
    throw new Error(`Failed to get profile info: ${error.message}`)
  }
}

// Optimized version of getUserPhotos that reuses the same prisma instance
async function getUserPhotosOptimized(userId: string, page: number = 1, limit: number = 20): Promise<PhotoListResponse> {
  const prisma = getPrisma()
  const skip = (page - 1) * limit
  
  // Filter out profile pictures from user photos
  const whereCondition = {
    userId,
    isProfilePicture: false
  }
  
  const [photos, totalCount] = await Promise.all([
    prisma.photo.findMany({
      where: whereCondition,
      include: { photoTags: { include: { tag: true } } },
      orderBy: { uploadedAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.photo.count({ where: whereCondition })
  ])
  
  const photoInfos: PhotoInfo[] = await Promise.all(photos.map(async (photo) => ({
    id: photo.id,
    userId: photo.userId,
    urls: { original: await getPresignedGetUrl(photo.key, 60 * 60 * 24 * 7) },
    uploadedAt: photo.uploadedAt,
    tags: photo.photoTags.map((pt) => ({
      id: pt.tag.id,
      name: pt.tag.name,
      displayName: pt.tag.displayName,
      emoji: pt.tag.emoji ?? undefined,
      color: pt.tag.color ?? undefined,
      category: pt.tag.category ?? undefined
    }))
  })))
  
  return { 
    photos: photoInfos, 
    totalCount, 
    hasMore: skip + photos.length < totalCount 
  }
}
