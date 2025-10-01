import { Elysia, t } from 'elysia'
import getPrisma from '../../dbConfig'
import { getPhotoTags } from '../../services/tag'

export const getPhotoTagsRoute = new Elysia()
  .get('/photos/:photoId', async ({ params, set }) => {
    try {
      const photoTags = await getPhotoTags(getPrisma(), params.photoId)
      return { success: true, data: photoTags.map((pt) => pt.tag) }
    } catch (error) {
      console.error('獲取照片標籤失敗:', error)
      set.status = 500
      return { success: false, error: '獲取照片標籤失敗' }
    }
  }, {
    params: t.Object({ photoId: t.String() })
  })


