import getPrisma from '../../dbConfig'
import { RatePhotoResponse, UserRankingResponse, RankingListResponse, UserStatsResponse } from './model'

// 計算總分：(❤️票數 × 1 + 🔄票數 × 0.2) ÷ 總票數 × 100
const calculateTotalScore = (likeCount: number, normalCount: number): number => {
  const totalVotes = likeCount + normalCount
  if (totalVotes === 0) return 0
  
  const weightedScore = (likeCount * 1 + normalCount * 0.2) / totalVotes
  return Math.round(weightedScore * 100)
}

export const ratePhoto = async (raterId: string, photoId: string, type: 'like' | 'normal'): Promise<RatePhotoResponse> => {
  try {
    // 驗證評分類型
    if (!['like', 'normal'].includes(type)) {
      throw new Error('Type must be "like" or "normal"')
    }

    // 獲取照片信息
    const photo = await getPrisma().photo.findUnique({
      where: { id: photoId },
      include: { user: true }
    })

    if (!photo) {
      throw new Error('Photo not found')
    }

    // 不能給自己的照片評分
    if (photo.userId === raterId) {
      throw new Error('Cannot rate your own photo')
    }

    // 創建或更新評分
    const rating = await getPrisma().rating.upsert({
      where: {
        raterId_photoId: {
          raterId,
          photoId
        }
      },
      update: {
        type
      },
      create: {
        raterId,
        ratedUserId: photo.userId,
        photoId,
        type
      }
    })

    return {
      success: true,
      rating: {
        id: rating.id,
        type: rating.type,
        createdAt: rating.createdAt
      }
    }
  } catch (error: any) {
    throw error
  }
}

export const getUserStats = async (userId: string): Promise<UserStatsResponse> => {
  try {
    // 獲取用戶基本信息
    const user = await getPrisma().user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      throw new Error('User not found')
    }

    // 計算各類評分數量
    const likeCount = await getPrisma().rating.count({
      where: { ratedUserId: userId, type: 'like' }
    })
    
    const normalCount = await getPrisma().rating.count({
      where: { ratedUserId: userId, type: 'normal' }
    })
    
    const totalRatings = likeCount + normalCount
    const totalScore = calculateTotalScore(likeCount, normalCount)

    // 獲取所有用戶的分數來計算排名
    const allUserStats = await getPrisma().rating.groupBy({
      by: ['ratedUserId'],
      where: {
        type: { in: ['like', 'normal'] }
      },
      _count: {
        _all: true
      }
    })

    // 計算每個用戶的分數
    const userScores = await Promise.all(
      allUserStats.map(async (stat) => {
        const userLikes = await getPrisma().rating.count({
          where: { ratedUserId: stat.ratedUserId, type: 'like' }
        })
        const userNormals = await getPrisma().rating.count({
          where: { ratedUserId: stat.ratedUserId, type: 'normal' }
        })
        
        return {
          userId: stat.ratedUserId,
          score: calculateTotalScore(userLikes, userNormals)
        }
      })
    )

    // 計算整體排名
    const betterUsers = userScores.filter(u => u.score > totalScore)
    const overallRank = betterUsers.length + 1

    // 獲取性別排名（如果有性別信息）
    let genderRank: number | undefined
    if (user.gender) {
      const sameGenderUsers = await getPrisma().user.findMany({
        where: { gender: user.gender },
        select: { id: true }
      })
      
      const sameGenderScores = userScores.filter(u => 
        sameGenderUsers.some(sgu => sgu.id === u.userId)
      )
      
      const betterSameGenderUsers = sameGenderScores.filter(u => u.score > totalScore)
      genderRank = betterSameGenderUsers.length + 1
    }

    // 獲取最近的評分
    const recentRatings = await getPrisma().rating.findMany({
      where: { ratedUserId: userId },
      include: {
        photo: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    return {
      userId,
      totalScore,
      likeCount,
      normalCount,
      totalRatings,
      overallRank,
      genderRank,
      recentRatings: recentRatings.map(rating => ({
        photoId: rating.photoId,
        photoUrl: rating.photo.url,
        type: rating.type,
        createdAt: rating.createdAt
      }))
    }
  } catch (error: any) {
    throw error
  }
}

export const getRankingList = async (limit: number = 50): Promise<RankingListResponse> => {
  try {
    // 獲取所有有評分的用戶
    const allUserStats = await getPrisma().rating.groupBy({
      by: ['ratedUserId'],
      where: {
        type: { in: ['like', 'normal'] }
      },
      _count: {
        _all: true
      }
    })

    // 計算每個用戶的分數和詳細信息
    const userScores = await Promise.all(
      allUserStats.map(async (stat) => {
        const user = await getPrisma().user.findUnique({
          where: { id: stat.ratedUserId }
        })
        
        const likeCount = await getPrisma().rating.count({
          where: { ratedUserId: stat.ratedUserId, type: 'like' }
        })
        const normalCount = await getPrisma().rating.count({
          where: { ratedUserId: stat.ratedUserId, type: 'normal' }
        })
        
        return {
          userId: stat.ratedUserId,
          name: user?.name || 'Unknown',
          avatar: user?.avatar,
          gender: user?.gender,
          totalScore: calculateTotalScore(likeCount, normalCount),
          likeCount,
          normalCount,
          totalRatings: likeCount + normalCount
        }
      })
    )

    // 按分數排序
    userScores.sort((a, b) => b.totalScore - a.totalScore)

    // 整體排名
    const overallUsers = userScores.slice(0, limit).map((user, index) => ({
      ...user,
      rank: index + 1
    }))

    // 男性排名
    const maleUsers = userScores
      .filter(user => user.gender === 'male')
      .slice(0, limit)
      .map((user, index) => ({
        ...user,
        rank: index + 1
      }))

    // 女性排名
    const femaleUsers = userScores
      .filter(user => user.gender === 'female')
      .slice(0, limit)
      .map((user, index) => ({
        ...user,
        rank: index + 1
      }))

    // 獲取總用戶數
    const totalUsers = await getPrisma().user.count()

    return {
      overall: overallUsers,
      male: maleUsers,
      female: femaleUsers,
      totalUsers
    }
  } catch (error: any) {
    throw error
  }
}

export const getRandomPhotosForRating = async (userId: string, limit: number = 10) => {
  try {
    // 獲取用戶還沒評分過的照片，排除自己的照片
    const photos = await getPrisma().photo.findMany({
      where: {
        AND: [
          { userId: { not: userId } }, // 不是自己的照片
          {
            ratings: {
              none: {
                raterId: userId // 還沒評分過
              }
            }
          }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            gender: true
          }
        }
      },
      take: limit * 2 // 取更多然後隨機選擇
    })

    // 隨機排序並取指定數量
    const shuffled = photos.sort(() => 0.5 - Math.random())
    return shuffled.slice(0, limit)
  } catch (error: any) {
    throw error
  }
}