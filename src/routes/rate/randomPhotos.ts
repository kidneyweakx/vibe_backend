import { Elysia } from 'elysia'
import { getRandomPhotosForRating } from './service'

export const randomPhotosRoute = new Elysia()
  .get('/photos/random', async ({ query, set }) => {
    try {
      const userId = query.userId as string
      const limit = parseInt(query.limit as string) || 10
      if (!userId) {
        set.status = 400
        return { success: false, error: 'userId is required' }
      }
      const photos = await getRandomPhotosForRating(userId, limit)
      return { success: true, data: photos }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: error.message }
    }
  })


