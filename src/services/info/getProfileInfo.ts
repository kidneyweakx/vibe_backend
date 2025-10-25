import type { PhotoInfo } from '../interfaces/file'
import type { JourneyDashboard } from '../rate/journeyService'
import { fetchProfileBundle } from './profileAggregator'

export interface ProfileInfoResponse {
  user: {
    id: string
    name: string | null
    avatar: string | null
    gender: string | null
    email: string | null
    provider: string | null
  }
  stats: JourneyDashboard
  photos: PhotoInfo[]
  latestPhoto: PhotoInfo | null
}

export async function getProfileInfo(userId: string, page: number = 1, limit: number = 20): Promise<ProfileInfoResponse> {
  try {
    const bundle = await fetchProfileBundle(userId, { page, limit, includePhotos: true })
    return {
      user: bundle.user,
      stats: bundle.stats,
      photos: bundle.photos,
      latestPhoto: bundle.latestPhoto
    }
  } catch (error: any) {
    console.error('Profile info error:', error)
    throw new Error(`Failed to get profile info: ${error.message}`)
  }
}
