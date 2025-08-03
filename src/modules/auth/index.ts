import { Elysia, t } from 'elysia'
import { AuthService } from './service'

export const auth = new Elysia({ prefix: '/auth' })
  .post('/google', async ({ body }) => {
    try {
      const user = await AuthService.signInWithGoogle(body.token)
      return { 
        success: true, 
        user,
        message: 'Google sign in successful'
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Google sign in failed'
      }
    }
  }, {
    body: t.Object({
      token: t.String()
    })
  })

  .post('/apple', async ({ body }) => {
    try {
      const user = await AuthService.signInWithApple(body.identityToken)
      return { 
        success: true, 
        user,
        message: 'Apple sign in successful'
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Apple sign in failed'
      }
    }
  }, {
    body: t.Object({
      identityToken: t.String()
    })
  })