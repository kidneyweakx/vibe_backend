import { Elysia } from 'elysia'
import { AuthService } from './service'

export const authMiddleware = new Elysia({ name: 'auth' })
  .derive(async ({ headers, set }) => {
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
  .derive(({ user, set }) => {
    if (!user) {
      set.status = 401
      throw new Error('Authentication required')
    }
    
    return { user }
  })