import { Elysia, t } from 'elysia'
import { getAllPhotos, deletePhoto, aggregateReportedPhotos, listAllReports } from '../file/service'

export const adminPhotosRoute = new Elysia()
  // List all photos (admin)
  .get('/photos', async ({ query, set }) => {
    try {
      const page = parseInt((query.page as string) || '1')
      const limit = parseInt((query.limit as string) || '20')
      const userId = (query.userId as string) || undefined
      const tagId = (query.tagId as string) || undefined

      const data = await getAllPhotos({ page, limit, userId, tagId })
      return { success: true, data }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: error.message }
    }
  })

  // Delete photo (admin)
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

  // List reported photos (admin)
  .get('/reports', async ({ query, set }) => {
    try {
      const page = parseInt((query.page as string) || '1')
      const limit = parseInt((query.limit as string) || '20')
      const minReports = parseInt((query.minReports as string) || '2')
      const data = await aggregateReportedPhotos(minReports, page, limit)
      return { success: true, data }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: error.message }
    }
  })

  // Full reports list (admin)
  .get('/reports/all', async ({ query, set }) => {
    try {
      const page = parseInt((query.page as string) || '1')
      const limit = parseInt((query.limit as string) || '20')
      const data = await listAllReports(page, limit)
      return { success: true, data }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: error.message }
    }
  })


