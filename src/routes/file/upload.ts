import { Elysia, t } from 'elysia'
import { uploadToR2 } from './service'

export const uploadRoute = new Elysia()
  .post('/upload', async ({ body, set }) => {
    const { file, key } = body as { file: File; key?: string }
    if (!file) {
      set.status = 400
      return { success: false, error: 'File is required' }
    }
    const result = await uploadToR2(file, { key })
    if (!result.success) {
      set.status = 400
      return result
    }
    return { success: true, data: { url: result.url, key: result.key } }
  }, {
    body: t.Object({
      file: t.File({ type: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], maxSize: '1m' }),
      key: t.Optional(t.String())
    })
  })


