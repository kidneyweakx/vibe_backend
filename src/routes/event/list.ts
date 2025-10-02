import { Elysia } from 'elysia'
import { listEvents } from '../../services/event'

export const eventListRoute = new Elysia()
  .get('/list', async ({ set, query }) => {
    try {
      // Parse limit with fallback to default (20)
      const parsedLimit = parseInt((query.limit as string) || '20')
      // Handle NaN and negative numbers - fallback to default 20
      // Allow zero and positive numbers (zero means no limit in Prisma)
      const limit = !isNaN(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 20

      const data = await listEvents(limit)
      return { success: true, data }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: error.message }
    }
  })


