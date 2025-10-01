import { Elysia, t } from 'elysia'
import { requireWritePermission } from '../../middlewares/admin'
import { deleteEvent } from '../../services/event'

export const adminEventDeleteRoute = new Elysia()
  .use(requireWritePermission)
  .delete('/events/:eventId', async ({ params, set }) => {
    try {
      const { eventId } = params as { eventId: string }
      if (!eventId) {
        set.status = 400
        return { success: false, error: 'eventId is required' }
      }

      const result = await deleteEvent(eventId)
      if (!result.success) {
        set.status = 400
        return { success: false, error: result.error || 'Failed to delete event' }
      }

      return { success: true }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: error.message }
    }
  }, {
    params: t.Object({ eventId: t.String() })
  })


