import { Elysia, t } from 'elysia'
import { ratePhoto } from '../../services/rate'

export const ratePhotoRoute = new Elysia()
  .post('/photo', async ({ body, user, set }: any) => {
    try {
      const { photoId, type } = body as { photoId: string; type: 'like' | 'normal' }
      if (!photoId || !type) {
        set.status = 400
        return { success: false, error: 'photoId and type are required' }
      }
      // Use authenticated user's ID as rater
      const result = await ratePhoto(user.id, photoId, type)
      return result
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({ photoId: t.String(), type: t.Union([t.Literal('like'), t.Literal('normal')]) })
  })


