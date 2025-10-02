import { Elysia, t } from 'elysia'
import getPrisma from '../../dbConfig'
import { getPresignedGetUrl } from '../../services/r2/presign'
import { getPhotosByTags } from '../../services/tag'

export const searchPhotosByTagsRoute = new Elysia()
  .get('/search', async ({ query, set }) => {
    // Handle tagIds - can be single value or array
    const tagIdsRaw = (query as any).tagIds || (query as any)['tagIds[]']
    const tagIds = Array.isArray(tagIdsRaw) ? tagIdsRaw : (tagIdsRaw ? [tagIdsRaw] : [])

    if (!tagIds || tagIds.length === 0) {
      set.status = 422
      return { success: false, error: '請選擇至少一個標籤' }
    }

    try {
      const limit = parseInt((query as any).limit) || 20
      const offset = parseInt((query as any).offset) || 0

      const photos = await getPhotosByTags(
        getPrisma(),
        tagIds,
        limit,
        offset
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
  })


