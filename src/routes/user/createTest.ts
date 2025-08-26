import { Elysia, t } from 'elysia'
import { UserService } from './service'

export const createTestUserRoute = new Elysia()
  .post('/test', async ({ body, set }) => {
    try {
      const user = await UserService.createTestUser((body as any).email, (body as any).name)
      return { success: true, data: user }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: `Failed to create test user: ${error.message}` }
    }
  }, {
    body: t.Object({ email: t.String(), name: t.Optional(t.String()) })
  })


