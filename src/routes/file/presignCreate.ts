import { Elysia, t } from 'elysia'
import { getPresignedPutUrl } from '../../services/r2/presign'
import { generatePhotoKey, getExtensionFromContentType } from '../../services/file'

export const presignCreateRoute = new Elysia()
  .post('/presign', async ({ body, set }) => {
    try {
      const { userId, contentType, key } = body as { userId: string; contentType?: string; key?: string }
      if (!userId) {
        set.status = 422
        return { success: false, error: 'userId is required' }
      }
      const ext = getExtensionFromContentType(contentType)
      const finalKey = key && key.length > 0 ? key : generatePhotoKey(userId, ext)
      const url = await getPresignedPutUrl(finalKey, contentType || `image/${ext}`, 60 * 10)
      return { success: true, data: { url, key: finalKey, headers: { 'Content-Type': contentType || `image/${ext}` } } }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({ userId: t.String(), contentType: t.Optional(t.String()), key: t.Optional(t.String()) })
  })


