import { Elysia, t } from 'elysia'
import { UserService } from './service'

export const user = new Elysia({ prefix: '/user' })
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
      const user = await UserService.updateUser(id, body)
      return { user }
    } catch (error) {
      return { error: 'Failed to update user' }
    }
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      avatar: t.Optional(t.String())
    })
  })

  .post('/test', async ({ body }) => {
    try {
      const user = await UserService.createTestUser(body.email, body.name)
      return { user }
    } catch (error) {
      return { error: 'Failed to create test user' }
    }
  }, {
    body: t.Object({
      email: t.String(),
      name: t.Optional(t.String())
    })
  })