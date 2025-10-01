import { Elysia, t } from 'elysia'
import { uploadEventImage } from '../../services/event'

export const adminEventUploadRoute = new Elysia()
  .post('/events', async ({ body, set }) => {
    try {
      const { title, description, imageBase64, startsAt, endsAt } = body as {
        title: string
        description?: string
        imageBase64: string
        startsAt: string
        endsAt?: string
      }
      const result = await uploadEventImage({
        title,
        description,
        imageBase64,
        startsAt: new Date(startsAt),
        endsAt: endsAt ? new Date(endsAt) : undefined
      })
      return { success: true, data: result }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      title: t.String(),
      description: t.Optional(t.String()),
      imageBase64: t.String(),
      startsAt: t.String(),
      endsAt: t.Optional(t.String())
    })
  })


