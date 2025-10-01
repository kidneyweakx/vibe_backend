import { Elysia, t } from 'elysia'
import { getPresignedPutUrl } from '../../services/r2/presign'
import { generatePhotoKey, getExtensionFromContentType } from '../../services/file'

export const presignCreateRoute = new Elysia()
  .post('/presign', async ({ body, user, set }: any) => {
    try {
      const { contentType, key } = body as { contentType?: string; key?: string }
      // Use authenticated user's ID instead of body parameter
      const ext = getExtensionFromContentType(contentType)
      const finalKey = key && key.length > 0 ? key : generatePhotoKey(user.id, ext)
      const url = await getPresignedPutUrl(finalKey, contentType || `image/${ext}`, 60 * 10)
      return { success: true, data: { url, key: finalKey, headers: { 'Content-Type': contentType || `image/${ext}` } } }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({ contentType: t.Optional(t.String()), key: t.Optional(t.String()) })
  })


