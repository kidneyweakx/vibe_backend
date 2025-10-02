import { Elysia } from 'elysia'
import { getUserPhotos } from '../../services/file'

export const photosGetByUserRoute = new Elysia()
  .get('/photos/user/:userId', async ({ params, query }) => {
    try {
      const { userId } = params
      const page = parseInt(query.page as string) || 1
      const limit = parseInt(query.limit as string) || 20
      const result = await getUserPhotos(userId, page, limit)
      // Return just the photos array for backward compatibility with tests
      return { success: true, data: result.photos }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })


