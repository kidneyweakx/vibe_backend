import { Elysia, t } from 'elysia'
import { requireWritePermission } from '../../middlewares/admin'
import { createEvent, uploadEventImage } from '../../services/event'

export const adminEventUploadRoute = new Elysia()
  .use(requireWritePermission)
  .post('/events', async ({ body, set }) => {
    try {
      const { title, description, imageBase64, externalUrl, eventUrl, startsAt, endsAt } = body as {
        title: string
        description?: string
        imageBase64?: string
        externalUrl?: string
        eventUrl?: string
        startsAt: string
        endsAt?: string
      }
      if (!imageBase64 && !externalUrl) {
        set.status = 400
        return { success: false, error: 'imageBase64 or externalUrl is required' }
      }
      const result = await createEvent(
        imageBase64
          ? {
              title,
              description,
              imageBase64,
              eventUrl,
              startsAt: new Date(startsAt),
              endsAt: endsAt ? new Date(endsAt) : undefined,
            }
          : {
              title,
              description,
              externalUrl: externalUrl!,
              eventUrl,
              startsAt: new Date(startsAt),
              endsAt: endsAt ? new Date(endsAt) : undefined,
            }
      )
      return { success: true, data: result }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      title: t.String(),
      description: t.Optional(t.String()),
      imageBase64: t.Optional(t.String()),
      externalUrl: t.Optional(t.String()),
      eventUrl: t.Optional(t.String()),
      startsAt: t.String(),
      endsAt: t.Optional(t.String())
    })
  })


