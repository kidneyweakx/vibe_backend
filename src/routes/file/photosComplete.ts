import { Elysia, t } from 'elysia'
import { confirmPhotoUpload, getExtensionFromContentType } from '../../services/file'

export const photosCompleteRoute = new Elysia()
  .post('/photos/complete', async ({ body, user, set }: any) => {
    try {
      const { key, contentType, sizeBytes } = body as { key: string; contentType?: string; sizeBytes?: number }
      if (!key) {
        set.status = 422
        return { success: false, error: 'key is required' }
      }
      // Use authenticated user's ID instead of body parameter
      const format = getExtensionFromContentType(contentType) || (key.split('.').pop() || 'png')
      const result = await confirmPhotoUpload({ userId: user.id, key, format, size: sizeBytes })
      return { success: true, data: result }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({ key: t.String(), contentType: t.Optional(t.String()), sizeBytes: t.Optional(t.Number()) })
  })


