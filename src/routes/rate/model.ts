export interface RatePhotoRequest {
  photoId: string
  type: 'like' | 'normal' // ❤️ or 🔄
}

export interface RatePhotoResponse {
  success: boolean
  rating: {
    id: string
    type: string
    createdAt: Date
  }
}

export interface UserRankingResponse {
  userId: string
  name: string
  avatar?: string
  gender?: string
  totalScore: number // 總分 (0-100)
  likeCount: number
  normalCount: number
  totalRatings: number
  rank: number
}

export interface RankingListResponse {
  overall: UserRankingResponse[]
  male: UserRankingResponse[]
  female: UserRankingResponse[]
  totalUsers: number
}

export interface UserStatsResponse {
  userId: string
  totalScore: number // 總分 (0-100)
  likeCount: number // ❤️ 數量
  normalCount: number // 🔄 數量
  totalRatings: number
  overallRank: number
  genderRank?: number
  recentRatings: Array<{
    photoId: string
    photoUrl: string
    type: string
    createdAt: Date
  }>
}