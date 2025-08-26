import { Elysia, t } from 'elysia'
import { UserService } from './service'

export const legacyUserRoutes = new Elysia()
  .get('/:id', async ({ params: { id } }) => {
    try {
      const user = await UserService.getUserById(id)
      if (!user) {
        return { error: 'User not found' }
      }
      return { user }
    } catch (error) {
      return { error: 'Failed to get user' }
    }
  })
  .put('/:id', async ({ params: { id }, body }) => {
    try {
      const user = await UserService.updateUser(id, body as any)
      return { user }
    } catch (error) {
      return { error: 'Failed to update user' }
    }
  }, {
    body: t.Object({ name: t.Optional(t.String()), avatar: t.Optional(t.String()) })
  })


