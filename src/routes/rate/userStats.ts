import { Elysia } from 'elysia'
import { getUserStats } from './service'

export const userStatsRoute = new Elysia()
  .get('/user/:userId/stats', async ({ params, set }) => {
    try {
      const result = await getUserStats(params.userId)
      return { success: true, data: result }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  })


