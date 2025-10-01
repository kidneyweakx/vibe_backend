import { Elysia } from 'elysia'
import { deletePhoto } from '../../services/file'

export const photosDeleteRoute = new Elysia()
  .delete('/photos/:photoId', async ({ params, set }) => {
    try {
      const result = await deletePhoto(params.photoId)
      if (!result.success) {
        set.status = 404
        return { success: false, error: result.error }
      }
      return { success: true }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: error.message }
    }
  })


