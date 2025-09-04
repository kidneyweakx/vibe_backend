import { Elysia, t } from 'elysia'
import { createReport } from './service'

export const reportRoute = new Elysia()
  .post('/report', async ({ body, set }) => {
    try {
      const { photoId, reporterId, reason } = body as { photoId: string; reporterId?: string; reason: string }
      if (!photoId || !reason) {
        set.status = 400
        return { success: false, error: 'photoId and reason are required' }
      }
      const report = await createReport({ photoId, reporterId, reason })
      return { success: true, data: { id: report.id } }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      photoId: t.String(),
      reporterId: t.Optional(t.String()),
      reason: t.String()
    })
  })


