import { Elysia, t } from 'elysia'
import getPrisma from '../../dbConfig'
import { requireAuth } from '../../middlewares/auth'
import { addTagsToPhoto } from '../../services/tag'

export const addPhotoTagsRoute = new Elysia()
  .use(requireAuth)
  .post('/photos/:photoId', async (ctx) => {
    const { params, body, user, set } = ctx as any
    try {
      const photo = await getPrisma().photo.findFirst({
        where: { id: params.photoId, userId: user.id }
      })
      if (!photo) {
        set.status = 404
        return { success: false, error: '照片不存在或無權限' }
      }
      await addTagsToPhoto(getPrisma(), params.photoId, (body as any).tagIds)

      // Return the added tags
      const tags = await getPrisma().photoTag.findMany({
        where: { photoId: params.photoId },
        include: { tag: true }
      })

      return { success: true, data: tags.map(pt => pt.tag) }
    } catch (error) {
      console.error('添加標籤失敗:', error)
      set.status = 500
      return { success: false, error: '添加標籤失敗' }
    }
  }, {
    params: t.Object({ photoId: t.String() }),
    body: t.Object({ tagIds: t.Array(t.String(), { minItems: 1 }) })
  })


