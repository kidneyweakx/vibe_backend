import { Elysia, t } from 'elysia'
import { AuthService } from '../../services/auth/service'

export const legacyAuthRoutes = new Elysia()
  .post('/google', async ({ body, set }) => {
    try {
      const authResponse = await AuthService.signInWithGoogle(body.token)
      return { 
        success: true, 
        ...authResponse,
        message: 'Google sign in successful'
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google sign in failed'
      const isAuthError = /invalid|unauthor/i.test(message)
      set.status = isAuthError ? 401 : 500
      return { success: false, error: message }
    }
  }, {
    body: t.Object({
      token: t.String()
    })
  })

