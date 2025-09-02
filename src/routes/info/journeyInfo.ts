import { Elysia } from 'elysia'
import { getJourneyDashboard } from '../../services/rate/journeyService'

export const journeyInfoRoute = new Elysia()
  .get('/journeyInfo/:userId', async ({ params, set }) => {
    try {
      const { userId } = params as { userId: string }
      
      if (!userId) {
        set.status = 400
        return { success: false, error: 'User ID is required' }
      }
      
      const journeyData = await getJourneyDashboard(userId)
      
      return {
        success: true,
        data: journeyData
      }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: error.message }
    }
  })
