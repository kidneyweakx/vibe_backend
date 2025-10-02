import { Elysia } from 'elysia'
import { AuthService } from '../services/auth/service'

export const authMiddleware = new Elysia({ name: 'auth' })
  .derive(async (ctx) => {
    const { headers } = ctx as any
    const authHeader = headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      return { user: null }
    }

    const token = authHeader.substring(7)
    const user = await AuthService.getUserFromToken(token)

    return { user }
  })

export const requireAuth = (app: any) =>
  app
    .derive(async ({ headers, set, error }: any) => {
      const authHeader = headers.authorization

      if (!authHeader?.startsWith('Bearer ')) {
        set.status = 401
        // Return error using Elysia's error method if available
        if (error) return error(401, 'Authentication required')
        throw new Error('Authentication required')
      }

      const token = authHeader.substring(7)
      const user = await AuthService.getUserFromToken(token)

      if (!user) {
        set.status = 401
        if (error) return error(401, 'Invalid or expired token')
        throw new Error('Invalid or expired token')
      }

      return { user }
    })
    .onError(({ code, error, set }: any) => {
      // Handle authentication errors specifically
      if (error.message === 'Authentication required' || error.message === 'Invalid or expired token') {
        set.status = 401
        return { error: error.message }
      }
    })


