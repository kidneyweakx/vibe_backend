import { Elysia } from 'elysia'
import { getRankingList } from '../rate/service'
import { listEvents } from '../event/service'

export const homeInfoRoute = new Elysia()
  .get('/homeInfo', async ({ set }) => {
    try {
      // Get top rank users (limit to 10 for home page)
      const topUsers = await getRankingList(10)
      
      // Get recent events (limit to 5 for home page)
      const recentEvents = await listEvents(5)
      
      return {
        success: true,
        data: {
          topUsers,
          recentEvents
        }
      }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: error.message }
    }
  })
