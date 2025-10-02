import { Elysia } from 'elysia'
import { AuthService } from '../services/auth/service'

export const authMiddleware = new Elysia()
  .derive(async ({ headers }: any) => {
    const authHeader = headers.authorization || headers.Authorization

    if (!authHeader?.startsWith('Bearer ')) {
      return { user: null }
    }

    const token = authHeader.substring(7)
    const user = await AuthService.getUserFromToken(token)

    return { user }
  })

export const requireAuth = (app: any) =>
  app
    .derive(async ({ headers }: any) => {
      const authHeader = headers.authorization || headers.Authorization

      if (!authHeader?.startsWith('Bearer ')) {
        return { user: null, authError: 'Authentication required' }
      }

      const token = authHeader.substring(7)
      const user = await AuthService.getUserFromToken(token)

      if (!user) {
        return { user: null, authError: 'Invalid or expired token' }
      }

      return { user, authError: null }
    })
    .onBeforeHandle(({ user, authError, set }: any) => {
      if (authError) {
        set.status = 401
        return { success: false, error: authError }
      }
    })


