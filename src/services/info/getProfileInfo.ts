import getPrisma from '../../dbConfig'
import { getJourneyDashboard } from '../rate/journeyService'
import { getPresignedGetUrl } from '../r2/presign'
import type { PhotoListResponse, PhotoInfo } from '../interfaces/file'

export interface ProfileInfoResponse {
  user: {
    id: string
    name: string | null
    avatar: string | undefined
    gender: string | null
    email: string | null
    provider: string | null
  }
  journey: {
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
  photos: PhotoListResponse
}

export async function getProfileInfo(userId: string, page: number = 1, limit: number = 20): Promise<ProfileInfoResponse> {
  const prisma = getPrisma()
  
  // Single optimized query to get user info, latest photo, and photo count
  const [userData, journeyData, photosData] = await Promise.all([
    // Get user basic info and latest photo in one query
    prisma.$queryRaw<Array<{
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
        SELECT DISTINCT ON (userId) userId, key, url
        FROM photos 
        WHERE key NOT LIKE 'profile-pictures/%'
        ORDER BY userId, uploadedAt DESC
      ) latest_photo ON u.id = latest_photo.userId
      WHERE u.id = ${userId}
    `,
    
    // Get journey dashboard data
    getJourneyDashboard(userId),
    
    // Get user photos with pagination
    getUserPhotosOptimized(userId, page, limit)
  ])

  if (userData.length === 0) {
    throw new Error('User not found')
  }

  const user = userData[0]
  
  // Generate avatar URL (prioritize latest photo over user avatar)
  let avatarUrl: string | undefined = undefined
  if (user.latestPhotoKey) {
    try {
      avatarUrl = await getPresignedGetUrl(user.latestPhotoKey, 60 * 60 * 24 * 7) // 7 days expiry
    } catch (error) {
      console.warn(`Failed to generate presigned URL for latest photo ${user.latestPhotoKey}:`, error)
    }
  }
  
  // Fallback to user's avatar if no latest photo available
  if (!avatarUrl && user.avatar) {
    try {
      avatarUrl = await getPresignedGetUrl(user.avatar, 60 * 60 * 24 * 7) // 7 days expiry
    } catch (error) {
      console.warn(`Failed to generate presigned URL for avatar ${user.avatar}:`, error)
    }
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
    journey: {
      totalScore: journeyData.totalScore,
      likeCount: journeyData.likeCount,
      normalCount: journeyData.normalCount,
      totalRatings: journeyData.totalRatings,
      overallRank: journeyData.overallRank,
      genderRank: journeyData.genderRank,
      totalUsers: journeyData.totalUsers,
      femaleAttraction: journeyData.femaleAttraction,
      maleAttraction: journeyData.maleAttraction,
      recentRatings: journeyData.recentRatings,
      weeklyTrend: journeyData.weeklyTrend,
      achievements: journeyData.achievements,
      nextMilestone: journeyData.nextMilestone,
      levelProgress: journeyData.levelProgress
    },
    photos: photosData
  }
}

// Optimized version of getUserPhotos that reuses the same prisma instance
async function getUserPhotosOptimized(userId: string, page: number = 1, limit: number = 20): Promise<PhotoListResponse> {
  const prisma = getPrisma()
  const skip = (page - 1) * limit
  
  const [photos, totalCount] = await Promise.all([
    prisma.photo.findMany({
      where: { userId },
      include: { photoTags: { include: { tag: true } } },
      orderBy: { uploadedAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.photo.count({ where: { userId } })
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
