import { Elysia } from 'elysia'
import { deletePhoto } from '../../services/file'
import getPrisma from '../../dbConfig'

export const photosDeleteRoute = new Elysia()
  .delete('/photos/:photoId', async ({ params, user, set }: any) => {
    try {
      // Verify photo ownership before deletion
      const photo = await getPrisma().photo.findUnique({
        where: { id: params.photoId },
        select: { userId: true }
      })

      if (!photo) {
        set.status = 404
        return { success: false, error: 'Photo not found' }
      }

      if (photo.userId !== user.id) {
        set.status = 403
        return { success: false, error: 'Can only delete your own photos' }
      }

      const result = await deletePhoto(params.photoId)
      if (!result.success) {
        set.status = 500
        return { success: false, error: result.error }
      }
      return { success: true }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: error.message }
    }
  })


