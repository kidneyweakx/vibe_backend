import { Elysia } from 'elysia'
import { AuthService } from '../../modules/auth/service'

export const verifyTokenRoute = new Elysia()
  .get('/verify', async ({ headers, set }) => {
    try {
      const authHeader = headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        set.status = 401
        throw new Error('No valid token provided')
      }

      const token = authHeader.substring(7)
      const user = await AuthService.getUserFromToken(token)
      
      if (!user) {
        set.status = 401
        throw new Error('Invalid token')
      }

      return {
        user: {
          id: user.id,
          name: user.name || '',
          email: user.email,
          profileImageURL: user.avatar
        }
      }
    } catch (error) {
      set.status = 401
      throw new Error(error instanceof Error ? error.message : 'Token verification failed')
    }
  })


