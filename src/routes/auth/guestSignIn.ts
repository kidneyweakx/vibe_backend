import { Elysia, t } from 'elysia'
import { AuthService } from '../../services/auth/service'

export const guestSignInRoute = new Elysia()
  .post('/guest/signin', async ({ body, set }) => {
    try {
      const authResponse = await AuthService.signInAsGuest(body.deviceId)
      return authResponse
    } catch (error) {
      set.status = 401
      throw new Error(error instanceof Error ? error.message : 'Guest authentication failed')
    }
  }, {
    body: t.Object({
      deviceId: t.String({ minLength: 1, description: 'Device identifier (UUID, device fingerprint, etc.)' })
    }),
    response: {
      200: t.Object({
        user: t.Object({
          id: t.Number(),
          name: t.String(),
          email: t.String(),
          isGuest: t.Boolean(),
          profileImageURL: t.Optional(t.String())
        }),
        token: t.String()
      })
    }
  })
