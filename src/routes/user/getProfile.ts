import { Elysia } from 'elysia'
import { UserService } from './service'

export const getProfileRoute = new Elysia()
  .get('/profile/:id', async ({ params: { id }, set }) => {
    try {
      const user = await UserService.getUserById(id)
      if (!user) {
        set.status = 404
        return { success: false, error: 'User not found' }
      }
      return { success: true, data: user }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: 'Failed to get user profile' }
    }
  })


