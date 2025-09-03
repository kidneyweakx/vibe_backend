import getPrisma from '../../dbConfig'
import { calculateTotalScore } from './calculateTotalScore'
import { getPresignedGetUrl } from '../r2/presign'

export async function getRankingList(limit: number = 50) {
  const prisma = getPrisma()
  
  // Use raw SQL to optimize the query with JOINs and aggregations
  const userScores = await prisma.$queryRaw<Array<{
    userId: string
    name: string | null
    avatar: string | null
    latestPhotoKey: string | null
    gender: string | null
    likeCount: bigint
    normalCount: bigint
    totalRatings: bigint
    totalScore: number
  }>>`
    SELECT 
      u.id as userId,
      u.name,
      u.avatar,
      u.gender,
      latest_photo.key as latestPhotoKey,
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
    LEFT JOIN (
      SELECT userId, key
      FROM photos p1
      WHERE key NOT LIKE 'profile-pictures/%'
        AND uploadedAt = (
          SELECT MAX(uploadedAt)
          FROM photos p2
          WHERE p2.userId = p1.userId
            AND p2.key NOT LIKE 'profile-pictures/%'
        )
    ) latest_photo ON u.id = latest_photo.userId
    WHERE u.id NOT LIKE 'guest%'
      AND (COALESCE(like_stats.likeCount, 0) + COALESCE(normal_stats.normalCount, 0)) > 0
    ORDER BY totalScore DESC
  `

  // Convert BigInt to number for JavaScript compatibility and generate presigned URLs for avatars
  const processedScores = await Promise.all(userScores.map(async (score) => {
    let avatarUrl: string | undefined = undefined
    
    // Prioritize user's profile picture over latest uploaded photo
    if (score.avatar) {
      try {
        avatarUrl = await getPresignedGetUrl(score.avatar, 60 * 60 * 24 * 7) // 7 days expiry
      } catch (error) {
        console.warn(`Failed to generate presigned URL for profile picture ${score.avatar}:`, error)
      }
    }
    
    // Fallback to latest uploaded photo if no profile picture available
    if (!avatarUrl && score.latestPhotoKey) {
      try {
        avatarUrl = await getPresignedGetUrl(score.latestPhotoKey, 60 * 60 * 24 * 7) // 7 days expiry
      } catch (error) {
        console.warn(`Failed to generate presigned URL for latest photo ${score.latestPhotoKey}:`, error)
      }
    }
    
    return {
      userId: score.userId,
      name: score.name || 'Unknown',
      avatar: avatarUrl,
      gender: score.gender ?? undefined,
      totalScore: Number(score.totalScore),
      likeCount: Number(score.likeCount),
      normalCount: Number(score.normalCount),
      totalRatings: Number(score.totalRatings)
    }
  }))

  // Get total users count
  const totalUsers = await prisma.user.count({ 
    where: { id: { not: { startsWith: 'guest' } } } 
  })

  // Generate rankings
  const overallUsers = processedScores.slice(0, limit).map((user, index) => ({ 
    ...user, 
    rank: index + 1 
  }))
  
  const maleUsers = processedScores
    .filter(u => u.gender === 'male')
    .slice(0, limit)
    .map((u, i) => ({ ...u, rank: i + 1 }))
    
  const femaleUsers = processedScores
    .filter(u => u.gender === 'female')
    .slice(0, limit)
    .map((u, i) => ({ ...u, rank: i + 1 }))

  return { 
    overall: overallUsers, 
    male: maleUsers, 
    female: femaleUsers, 
    totalUsers 
  }
}


