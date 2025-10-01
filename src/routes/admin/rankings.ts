import { Elysia } from 'elysia'
import { getRankingList } from '../rate/service'

export const adminRankingsRoute = new Elysia()
  .get('/rankings', async ({ query, set }) => {
    try {
      const limit = parseInt(query.limit as string) || 20
      const result = await getRankingList(limit)
      return { success: true, data: result }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: error.message }
    }
  })


