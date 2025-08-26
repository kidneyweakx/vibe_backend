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

export const requireAuth = new Elysia({ name: 'requireAuth' })
  .use(authMiddleware)
  .derive((ctx) => {
    const { user, set } = ctx as any
    if (!user) {
      set.status = 401
      throw new Error('Authentication required')
    }
    return { user }
  })


