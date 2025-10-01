import { Elysia, t } from 'elysia'
import { createReport } from '../../services/file'

export const reportRoute = new Elysia()
  .post('/report', async ({ body, user, set }: any) => {
    try {
      const { photoId, reason } = body as { photoId: string; reason: string }
      if (!photoId || !reason) {
        set.status = 400
        return { success: false, error: 'photoId and reason are required' }
      }
      // Use authenticated user's ID as reporter
      const report = await createReport({ photoId, reporterId: user.id, reason })
      return { success: true, data: { id: report.id } }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      photoId: t.String(),
      reason: t.String()
    })
  })


