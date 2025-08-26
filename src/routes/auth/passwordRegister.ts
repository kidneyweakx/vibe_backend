import { Elysia, t } from 'elysia'
import { AuthService } from '../../services/auth/service'

export const passwordRegisterRoute = new Elysia()
  .post('/password/register', async ({ body, set }) => {
    try {
      const authResponse = await AuthService.registerWithPassword(body.email, body.password, body.name)
      set.status = 201
      return authResponse
    } catch (error) {
      set.status = 400
      throw new Error(error instanceof Error ? error.message : 'Registration failed')
    }
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
      name: t.Optional(t.String())
    })
  })


