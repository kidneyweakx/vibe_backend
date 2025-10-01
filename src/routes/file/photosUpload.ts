import { Elysia, t } from 'elysia'
import { uploadPhoto } from '../../services/file'

export const photosUploadRoute = new Elysia()
  .post('/photos/upload', async ({ body, user, set }: any) => {
    try {
      const { imageData, format } = body as { imageData: string; format?: string }
      if (!imageData) {
        set.status = 400
        return { success: false, error: 'imageData is required' }
      }
      // Use authenticated user's ID instead of body parameter
      const result = await uploadPhoto(imageData, user.id, format)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('Photo upload API error:', error)
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({ imageData: t.String(), format: t.Optional(t.String()) })
  })


