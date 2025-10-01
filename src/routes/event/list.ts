import { Elysia } from 'elysia'
import { listEvents } from '../../services/event'

export const eventListRoute = new Elysia()
  .get('/list', async ({ set, query }) => {
    try {
      const limit = parseInt((query.limit as string) || '20')
      const data = await listEvents(limit)
      return { success: true, data }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: error.message }
    }
  })


