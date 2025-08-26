import { Elysia, t } from 'elysia'
import { getPresignedPutUrl } from './presign'
import { generatePhotoKey } from './service'

export const photosPresignRoute = new Elysia()
  .post('/photos/presign', async ({ body, set }) => {
    try {
      const { userId, format, contentType } = body as { userId: string; format?: string; contentType?: string }
      if (!userId) {
        set.status = 400
        return { success: false, error: 'userId is required' }
      }
      const key = generatePhotoKey(userId, format || 'png')
      const url = await getPresignedPutUrl(key, contentType || `image/${format || 'png'}`, 60 * 10)
      return { success: true, data: { key, url } }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({ userId: t.String(), format: t.Optional(t.String()), contentType: t.Optional(t.String()) })
  })


