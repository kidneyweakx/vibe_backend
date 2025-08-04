import { Elysia, t } from 'elysia'
import { AuthService } from './service'

export const auth = new Elysia({ prefix: '/auth' })
  // Google Authentication - matches Swift client expectations
  .post('/google/verify', async ({ body, set }) => {
    try {
      const authResponse = await AuthService.signInWithGoogle(body.idToken, body.accessToken)
      return authResponse
    } catch (error) {
      set.status = 401
      throw new Error(error instanceof Error ? error.message : 'Google authentication failed')
    }
  }, {
    body: t.Object({
      idToken: t.String(),
      accessToken: t.Optional(t.String())
    })
  })

  // Apple Authentication - matches Swift client expectations
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
      set.status = 401
      throw new Error(error instanceof Error ? error.message : 'Apple authentication failed')
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

  // Password Authentication - matches Swift client expectations
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

  // Password Registration
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

  // Sign Out
  .post('/signout', async ({ headers, set }) => {
    try {
      // In a stateless JWT system, signout is handled client-side
      // You could implement token blacklisting here if needed
      return { success: true, message: 'Signed out successfully' }
    } catch (error) {
      set.status = 500
      throw new Error('Sign out failed')
    }
  })

  // Verify current token (useful for checking auth status)
  .get('/verify', async ({ headers, set }) => {
    try {
      const authHeader = headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        set.status = 401
        throw new Error('No valid token provided')
      }

      const token = authHeader.substring(7)
      const user = await AuthService.getUserFromToken(token)
      
      if (!user) {
        set.status = 401
        throw new Error('Invalid token')
      }

      return {
        user: {
          id: user.id,
          name: user.name || '',
          email: user.email,
          profileImageURL: user.avatar
        }
      }
    } catch (error) {
      set.status = 401
      throw new Error(error instanceof Error ? error.message : 'Token verification failed')
    }
  })

  // Legacy endpoints for backward compatibility
  .post('/google', async ({ body }) => {
    try {
      const authResponse = await AuthService.signInWithGoogle(body.token)
      return { 
        success: true, 
        ...authResponse,
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
      const authResponse = await AuthService.signInWithApple({
        idToken: body.identityToken,
        nonce: '',
        userIdentifier: body.identityToken // fallback
      })
      return { 
        success: true, 
        ...authResponse,
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