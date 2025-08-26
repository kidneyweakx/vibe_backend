import { Elysia } from 'elysia'
import { getRankingList } from './service'

export const rankingsRoute = new Elysia()
  .get('/rankings', async ({ query, set }) => {
    try {
      const limit = parseInt(query.limit as string) || 50
      const result = await getRankingList(limit)
      return { success: true, data: result }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: error.message }
    }
  })


