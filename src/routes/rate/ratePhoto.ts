import { Elysia, t } from 'elysia'
import { ratePhoto } from './service'

export const ratePhotoRoute = new Elysia()
  .post('/photo', async ({ body, set }) => {
    try {
      const { raterId, photoId, type } = body as { raterId: string; photoId: string; type: 'like' | 'normal' }
      if (!raterId || !photoId || !type) {
        set.status = 400
        return { success: false, error: 'raterId, photoId and type are required' }
      }
      const result = await ratePhoto(raterId, photoId, type)
      return result
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({ raterId: t.String(), photoId: t.String(), type: t.Union([t.Literal('like'), t.Literal('normal')]) })
  })


