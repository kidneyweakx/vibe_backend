import { Elysia, t } from 'elysia'
import { AuthService } from '../../services/auth/service'

export const googleVerifyRoute = new Elysia()
  // Main Google auth endpoint
  .post('/google', async ({ body, set }) => {
    try {
      // Support both old format (token) and new format (idToken)
      const idToken = 'idToken' in body ? body.idToken : body.token
      const accessToken = 'accessToken' in body ? body.accessToken : undefined
      
      const authResponse = await AuthService.signInWithGoogle(idToken, accessToken)
      return authResponse
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google authentication failed'
      const isAuthError = /invalid|unauthor/i.test(message)
      set.status = isAuthError ? 401 : 500
      return { success: false, error: message }
    }
  }, {
    body: t.Object({
      // Support both old and new field names
      token: t.Optional(t.String()),
      idToken: t.Optional(t.String()),
      accessToken: t.Optional(t.String())
    })
  })


