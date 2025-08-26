import { Elysia, t } from 'elysia'
import { TagService } from './service'
import getPrisma from '../../dbConfig'

export const getPhotoTagsRoute = new Elysia()
  .get('/photos/:photoId', async ({ params, set }) => {
    const tagService = new TagService(getPrisma())
    try {
      const photoTags = await tagService.getPhotoTags(params.photoId)
      return { success: true, data: photoTags.map((pt) => pt.tag) }
    } catch (error) {
      console.error('獲取照片標籤失敗:', error)
      set.status = 500
      return { success: false, error: '獲取照片標籤失敗' }
    }
  }, {
    params: t.Object({ photoId: t.String() })
  })


