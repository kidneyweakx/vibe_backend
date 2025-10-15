import { Elysia, t } from 'elysia'
import { requireWritePermission } from '../../middlewares/admin'
import { updateEvent } from '../../services/event'

export const adminEventEditRoute = new Elysia()
  .use(requireWritePermission)
  .patch('/events/:eventId', async ({ params, body, set }) => {
    try {
      const { eventId } = params as { eventId: string }
      const { title, description, startsAt, endsAt, newImageBase64, externalUrl } = body as {
        title?: string
        description?: string
        startsAt?: string
        endsAt?: string
        newImageBase64?: string
        externalUrl?: string
      }

      const updated = await updateEvent({
        eventId,
        title,
        description,
        startsAt: startsAt ? new Date(startsAt) : undefined,
        endsAt: endsAt ? new Date(endsAt) : undefined,
        newImageBase64,
        externalUrl,
      })
      return { success: true, data: updated }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    params: t.Object({
      eventId: t.String(),
    }),
    body: t.Object({
      title: t.Optional(t.String()),
      description: t.Optional(t.String()),
      startsAt: t.Optional(t.String()),
      endsAt: t.Optional(t.String()),
      newImageBase64: t.Optional(t.String()),
      externalUrl: t.Optional(t.String()),
    })
  })


