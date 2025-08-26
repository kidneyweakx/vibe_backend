import { Elysia, t } from 'elysia'
import { AuthService } from '../../services/auth/service'

export const passwordVerifyRoute = new Elysia()
  .post('/password/verify', async ({ body, set }) => {
    try {
      const authResponse = await AuthService.signInWithPassword(body.username, body.password)
      return authResponse
    } catch (error) {
      set.status = 401
      throw new Error(error instanceof Error ? error.message : 'Invalid credentials')
    }
  }, {
    body: t.Object({
      username: t.String(),
      password: t.String()
    })
  })


