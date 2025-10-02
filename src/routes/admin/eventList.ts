import { Elysia } from 'elysia'
import { listEvents } from '../../services/event'

export const adminEventListRoute = new Elysia()
  // Read-only route - Available on Cloudflare with admin key
  .get('/events', async ({ query, set }) => {
    try {
      const limit = parseInt((query.limit as string) || '100')
      const data = await listEvents(limit)
      return { success: true, data }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: error.message }
    }
  })

