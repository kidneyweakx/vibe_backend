import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { Elysia } from 'elysia'
import { authMiddleware, requireAuth } from '../../src/middlewares/auth'
import { accessTokenMiddleware } from '../../src/middlewares/accessToken'
import { adminMiddleware } from '../../src/middlewares/admin'
import { createAuthenticatedTestUser, cleanDatabase, closeDatabase } from '../helpers/db'
import { getEnvVar } from '../../src/env'

describe('Middlewares', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeDatabase()
  })

  describe('authMiddleware', () => {
    test('extracts user from valid Bearer token', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'auth@example.com'
      })

      const app = new Elysia()
        .use(authMiddleware)
        .get('/test', ({ user }) => ({ userId: user?.id }))

      const response = await app.handle(
        new Request('http://localhost/test', {
          headers: { Authorization: `Bearer ${token}` }
        })
      )

      const data = await response.json()
      expect(data.userId).toBe(user.id)
    })

    test('returns null user when no token provided', async () => {
      const app = new Elysia()
        .use(authMiddleware)
        .get('/test', ({ user }) => ({ hasUser: !!user }))

      const response = await app.handle(
        new Request('http://localhost/test')
      )

      const data = await response.json()
      expect(data.hasUser).toBe(false)
    })

    test('returns null user for invalid token', async () => {
      const app = new Elysia()
        .use(authMiddleware)
        .get('/test', ({ user }) => ({ hasUser: !!user }))

      const response = await app.handle(
        new Request('http://localhost/test', {
          headers: { Authorization: 'Bearer invalid-token' }
        })
      )

      const data = await response.json()
      expect(data.hasUser).toBe(false)
    })

    test('handles authorization header without Bearer prefix', async () => {
      const app = new Elysia()
        .use(authMiddleware)
        .get('/test', ({ user }) => ({ hasUser: !!user }))

      const response = await app.handle(
        new Request('http://localhost/test', {
          headers: { Authorization: 'some-token' }
        })
      )

      const data = await response.json()
      expect(data.hasUser).toBe(false)
    })
  })

  describe('requireAuth', () => {
    test('allows request with valid token', async () => {
      const { user, token } = await createAuthenticatedTestUser({
        email: 'require-auth@example.com'
      })

      const app = requireAuth(new Elysia())
        .get('/protected', ({ user }) => ({ userId: user.id }))

      const response = await app.handle(
        new Request('http://localhost/protected', {
          headers: { Authorization: `Bearer ${token}` }
        })
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.userId).toBe(user.id)
    })

    test('returns 401 when no token provided', async () => {
      const app = requireAuth(new Elysia())
        .get('/protected', ({ user }) => ({ userId: user.id }))

      const response = await app.handle(
        new Request('http://localhost/protected')
      )

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Authentication required')
    })

    test('returns 401 for invalid token', async () => {
      const app = requireAuth(new Elysia())
        .get('/protected', ({ user }) => ({ userId: user.id }))

      const response = await app.handle(
        new Request('http://localhost/protected', {
          headers: { Authorization: 'Bearer invalid-token' }
        })
      )

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid or expired token')
    })

    test('returns 401 for malformed authorization header', async () => {
      const app = requireAuth(new Elysia())
        .get('/protected', ({ user }) => ({ userId: user.id }))

      const response = await app.handle(
        new Request('http://localhost/protected', {
          headers: { Authorization: 'InvalidFormat' }
        })
      )

      expect(response.status).toBe(401)
    })
  })

  describe('accessTokenMiddleware', () => {
    test('allows request with valid X-Access-Token', async () => {
      const validToken = getEnvVar('API_ACCESS_TOKEN')

      const app = new Elysia()
        .use(accessTokenMiddleware)
        .get('/admin', () => ({ success: true }))

      const response = await app.handle(
        new Request('http://localhost/admin', {
          headers: { 'x-access-token': validToken }
        })
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    test('allows request with valid Bearer token matching API_ACCESS_TOKEN', async () => {
      const validToken = getEnvVar('API_ACCESS_TOKEN')

      const app = new Elysia()
        .use(accessTokenMiddleware)
        .get('/admin', () => ({ success: true }))

      const response = await app.handle(
        new Request('http://localhost/admin', {
          headers: { 'authorization': `Bearer ${validToken}` }
        })
      )

      expect(response.status).toBe(200)
    })

    test('returns 401 when no token provided', async () => {
      const app = new Elysia()
        .use(accessTokenMiddleware)
        .get('/admin', () => ({ success: true }))

      const response = await app.handle(
        new Request('http://localhost/admin')
      )

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
      expect(data.message).toBe('Access token is required')
    })

    test('returns 401 for invalid token', async () => {
      const app = new Elysia()
        .use(accessTokenMiddleware)
        .get('/admin', () => ({ success: true }))

      const response = await app.handle(
        new Request('http://localhost/admin', {
          headers: { 'x-access-token': 'invalid-token' }
        })
      )

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
      expect(data.message).toBe('Invalid access token')
    })

    test('allows OPTIONS requests without token', async () => {
      const app = new Elysia()
        .use(accessTokenMiddleware)
        .options('/admin', () => ({ success: true }))

      const response = await app.handle(
        new Request('http://localhost/admin', { method: 'OPTIONS' })
      )

      expect(response.status).toBe(200)
    })
  })

  describe('adminMiddleware', () => {
    test('allows requests in local environment without admin key', async () => {
      const app = new Elysia()
        .use(adminMiddleware)
        .get('/admin-route', ({ isAdmin, canWrite }) => ({ isAdmin, canWrite }))

      const response = await app.handle(
        new Request('http://localhost/admin-route')
      )

      const data = await response.json()
      expect(data.isAdmin).toBe(true)
      expect(data.canWrite).toBe(true)
    })
  })
})
