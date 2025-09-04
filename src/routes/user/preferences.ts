import { Elysia, t } from 'elysia'
import getPrisma from '../../dbConfig'

export const userPreferencesRoute = new Elysia()
  .get('/preferences/:id', async ({ params: { id }, set }) => {
    try {
      const user = await getPrisma().user.findUnique({ where: { id } }) as any
      if (!user) { set.status = 404; return { success: false, error: 'User not found' } }
      return { success: true, data: {
        notificationsEnabled: !!user.notificationsEnabled,
        language: user.language ?? null,
        timezone: user.timezone ?? null
      } }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  })
  .put('/preferences/:id', async ({ params: { id }, body, set }) => {
    try {
      const updated = await getPrisma().user.update({ where: { id }, data: body as any }) as any
      return { success: true, data: {
        notificationsEnabled: !!updated.notificationsEnabled,
        language: updated.language ?? null,
        timezone: updated.timezone ?? null
      } }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      notificationsEnabled: t.Optional(t.Boolean()),
      language: t.Optional(t.String()),
      timezone: t.Optional(t.String())
    })
  })


