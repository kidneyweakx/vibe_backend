import { Elysia, t } from 'elysia'
import { createReport } from '../../services/file'
import { checkAndHidePhoto } from '../../services/photo/autoHide'

export const reportRoute = new Elysia()
  .post('/report', async ({ body, user, set }: any) => {
    try {
      const { photoId, reason, details } = body as {
        photoId: string
        reason: string
        details?: string
      }

      if (!photoId || !reason) {
        set.status = 400
        return { success: false, error: 'photoId and reason are required' }
      }

      // Validate reason
      const validReasons = ['inappropriate', 'spam', 'harassment', 'nudity', 'violence', 'other']
      if (!validReasons.includes(reason)) {
        set.status = 400
        return { success: false, error: 'Invalid reason' }
      }

      // Use authenticated user's ID as reporter
      const report = await createReport({
        photoId,
        reporterId: user.id,
        reason,
        details
      })

      // Check if photo should be auto-hidden
      const hideResult = await checkAndHidePhoto(photoId)

      return {
        success: true,
        data: {
          reportId: report.id,
          photoStatus: hideResult.status,
          reportCount: hideResult.reportCount,
          hidden: hideResult.hidden
        }
      }
    } catch (error: any) {
      console.error('Report creation error:', error)
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      photoId: t.String(),
      reason: t.String(),
      details: t.Optional(t.String())
    })
  })


