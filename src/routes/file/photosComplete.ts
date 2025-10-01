import { Elysia, t } from 'elysia'
import { confirmPhotoUpload, getExtensionFromContentType } from '../../services/file'

export const photosCompleteRoute = new Elysia()
  .post('/photos/complete', async ({ body, set }) => {
    try {
      const { userId, key, contentType, sizeBytes } = body as { userId: string; key: string; contentType?: string; sizeBytes?: number }
      if (!userId || !key) {
        set.status = 422
        return { success: false, error: 'userId and key are required' }
      }
      const format = getExtensionFromContentType(contentType) || (key.split('.').pop() || 'png')
      const result = await confirmPhotoUpload({ userId, key, format, size: sizeBytes })
      return { success: true, data: result }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({ userId: t.String(), key: t.String(), contentType: t.Optional(t.String()), sizeBytes: t.Optional(t.Number()) })
  })


