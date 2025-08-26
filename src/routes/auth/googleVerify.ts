import { Elysia, t } from 'elysia'
import { AuthService } from '../../modules/auth/service'

export const googleVerifyRoute = new Elysia()
  .post('/google/verify', async ({ body, set }) => {
    try {
      const authResponse = await AuthService.signInWithGoogle(body.idToken, body.accessToken)
      return authResponse
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google authentication failed'
      const isAuthError = /invalid|unauthor/i.test(message)
      set.status = isAuthError ? 401 : 500
      return { success: false, error: message }
    }
  }, {
    body: t.Object({
      idToken: t.String(),
      accessToken: t.Optional(t.String())
    })
  })


