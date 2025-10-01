import { Elysia, t } from 'elysia'
import { UserService } from '../../services/user/serviceAdapter'

export const updateProfileRoute = new Elysia()
  .put('/profile/:id', async ({ params: { id }, body, user, set }: any) => {
    try {
      // Users can only update their own profile
      if (user.id !== id) {
        set.status = 403
        return { success: false, error: 'Can only update your own profile' }
      }

      const updatedUser = await UserService.updateUser(id, body as any)
      return { success: true, data: updatedUser }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: 'Failed to update user' }
    }
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      avatar: t.Optional(t.String()),
      gender: t.Optional(t.Union([t.Literal('male'), t.Literal('female'), t.Literal('other')])),
      bio: t.Optional(t.String()),
      location: t.Optional(t.String()),
      language: t.Optional(t.String()),
      timezone: t.Optional(t.String()),
      notificationsEnabled: t.Optional(t.Boolean())
    })
  })


