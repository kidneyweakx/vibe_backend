import { Elysia } from 'elysia'
import { getProfileInfo } from '../../services/info'

export const profileInfoRoute = new Elysia()
  .get('/profileInfo/:userId', async ({ params, query, set }) => {
    try {
      const { userId } = params as { userId: string }
      const page = parseInt(query.page as string) || 1
      const limit = Math.min(parseInt(query.limit as string) || 20, 60) // Max 60 photos
      
      if (!userId) {
        set.status = 400
        return { success: false, error: 'User ID is required' }
      }

      // Get all profile information using optimized service
      const profileData = await getProfileInfo(userId, page, limit)

      return {
        success: true,
        data: profileData
      }
    } catch (error: any) {
      console.error('Profile info API error:', error)
      if (error.message?.includes('User not found')) {
        set.status = 404
        return { success: false, error: 'User not found' }
      }
      set.status = 500
      return { success: false, error: error.message }
    }
  })
