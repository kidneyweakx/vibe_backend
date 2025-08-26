import { Elysia, t } from 'elysia'
import { AuthService } from '../../modules/auth/service'

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
  .post('/apple', async ({ body, set }) => {
    try {
      const authResponse = await AuthService.signInWithApple({
        idToken: body.identityToken,
        nonce: '',
        userIdentifier: body.identityToken
      })
      return { 
        success: true, 
        ...authResponse,
        message: 'Apple sign in successful'
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Apple sign in failed'
      const isAuthError = /invalid|unauthor/i.test(message)
      set.status = isAuthError ? 401 : 500
      return { success: false, error: message }
    }
  }, {
    body: t.Object({
      identityToken: t.String()
    })
  })


