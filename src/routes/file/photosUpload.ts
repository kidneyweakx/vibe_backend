import { Elysia, t } from 'elysia'
import { uploadPhoto } from './service'

export const photosUploadRoute = new Elysia()
  .post('/photos/upload', async ({ body, set }) => {
    try {
      const { userId, imageData, format } = body as { userId: string; imageData: string; format?: string }
      if (!userId || !imageData) {
        set.status = 400
        return { success: false, error: 'userId and imageData are required' }
      }
      const result = await uploadPhoto(imageData, userId, format)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('Photo upload API error:', error)
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({ userId: t.String(), imageData: t.String(), format: t.Optional(t.String()) })
  })


