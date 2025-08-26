import { Elysia, t } from 'elysia'
import { AuthService } from '../../services/auth/service'

export const appleVerifyRoute = new Elysia()
  .post('/apple/verify', async ({ body, set }) => {
    try {
      const authResponse = await AuthService.signInWithApple({
        idToken: body.idToken,
        nonce: body.nonce,
        userIdentifier: body.userIdentifier,
        email: body.email,
        fullName: body.fullName
      })
      return authResponse
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Apple authentication failed'
      const isAuthError = /invalid|unauthor/i.test(message)
      set.status = isAuthError ? 401 : 500
      return { success: false, error: message }
    }
  }, {
    body: t.Object({
      idToken: t.String(),
      nonce: t.String(),
      userIdentifier: t.String(),
      email: t.Optional(t.String()),
      fullName: t.Optional(t.Object({
        givenName: t.Optional(t.String()),
        familyName: t.Optional(t.String())
      }))
    })
  })


