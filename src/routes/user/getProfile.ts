import { Elysia } from 'elysia'
import { UserService } from '../../services/user/serviceAdapter'

export const getProfileRoute = new Elysia()
  .get('/profile/:id', async ({ params: { id }, user, set }: any) => {
    try {
      // Users can only view their own full profile
      if (user.id !== id) {
        set.status = 403
        return { success: false, error: 'Can only view your own profile. Use /user/info/:id for public profiles.' }
      }

      const userData = await UserService.getUserById(id)
      if (!userData) {
        set.status = 404
        return { success: false, error: 'User not found' }
      }
      return { success: true, data: userData }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: 'Failed to get user profile' }
    }
  })


