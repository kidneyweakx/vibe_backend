import { Elysia, t } from 'elysia'
import getPrisma from '../../dbConfig'
import { getPresignedGetUrl } from '../../services/r2/presign'
import { getPhotosByTags } from '../../services/tag'

export const searchPhotosByTagsRoute = new Elysia()
  .get('/search', async ({ query, set }) => {
    if (!(query as any).tagIds || (query as any).tagIds.length === 0) {
      set.status = 400
      return { success: false, error: '請選擇至少一個標籤' }
    }
    try {
      const photos = await getPhotosByTags(
        getPrisma(),
        (query as any).tagIds,
        (query as any).limit || 20,
        (query as any).offset || 0
      )
      const transformed = await Promise.all(
        photos.map(async (p: any) => ({
          ...p,
          url: await getPresignedGetUrl(p.key, 60 * 60 * 24 * 7)
        }))
      )
      return { success: true, data: transformed }
    } catch (error) {
      console.error('搜索照片失敗:', error)
      set.status = 500
      return { success: false, error: '搜索照片失敗' }
    }
  }, {
    query: t.Object({
      tagIds: t.Array(t.String()),
      limit: t.Optional(t.Number()),
      offset: t.Optional(t.Number())
    })
  })


