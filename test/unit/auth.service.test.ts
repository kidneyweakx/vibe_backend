import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { AuthService } from '../../src/services/auth/service'
import { cleanDatabase, closeDatabase, createTestUser } from '../helpers/db'

describe('Auth Service', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeDatabase()
  })

  describe('JWT Operations', () => {
    test('generates JWT token async', async () => {
      const userId = 'test-user-123'
      const token = await AuthService.generateJWTAsync(userId)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.').length).toBe(3) // JWT has 3 parts
    })

    test('verifies valid JWT token', async () => {
      const userId = 'test-user-456'
      const token = await AuthService.generateJWTAsync(userId)

      const payload = await AuthService.verifyJWTAsync(token)

      expect(payload).toBeDefined()
      expect(payload?.userId).toBe(userId)
    })

    test('returns null for invalid JWT token', async () => {
      const invalidToken = 'invalid.token.here'

      const payload = await AuthService.verifyJWTAsync(invalidToken)

      expect(payload).toBeNull()
    })

    test('returns null for expired JWT token', async () => {
      // Create a token with a very short expiration
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key')
      const jose = await import('jose')

      const expiredToken = await new jose.SignJWT({ userId: 'test' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('0s') // Expires immediately
        .sign(secret)

      // Wait a bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 100))

      const payload = await AuthService.verifyJWTAsync(expiredToken)

      expect(payload).toBeNull()
    })

    test('throws error when calling synchronous generateJWT', () => {
      expect(() => AuthService.generateJWT('test')).toThrow()
    })
  })

  describe('Password Operations', () => {
    test('hashes password', async () => {
      const password = 'mySecurePassword123'
      const hashedPassword = await AuthService.hashPassword(password)

      expect(hashedPassword).toBeDefined()
      expect(hashedPassword).not.toBe(password)
      expect(hashedPassword.startsWith('$2a$')).toBe(true) // bcrypt hash format
    })

    test('verifies correct password', async () => {
      const password = 'testPassword456'
      const hashedPassword = await AuthService.hashPassword(password)

      const isValid = await AuthService.verifyPassword(password, hashedPassword)

      expect(isValid).toBe(true)
    })

    test('rejects incorrect password', async () => {
      const password = 'correctPassword'
      const wrongPassword = 'wrongPassword'
      const hashedPassword = await AuthService.hashPassword(password)

      const isValid = await AuthService.verifyPassword(wrongPassword, hashedPassword)

      expect(isValid).toBe(false)
    })

    test('generates different hashes for same password', async () => {
      const password = 'samePassword'
      const hash1 = await AuthService.hashPassword(password)
      const hash2 = await AuthService.hashPassword(password)

      expect(hash1).not.toBe(hash2) // Different salts
      expect(await AuthService.verifyPassword(password, hash1)).toBe(true)
      expect(await AuthService.verifyPassword(password, hash2)).toBe(true)
    })
  })

  describe('getUserFromToken', () => {
    test('returns user for valid token', async () => {
      const testUser = await createTestUser({
        email: 'token@example.com',
        name: 'Token User'
      })

      const token = await AuthService.generateJWTAsync(testUser.id)

      const user = await AuthService.getUserFromToken(token)

      expect(user).toBeDefined()
      expect(user?.id).toBe(testUser.id)
      expect(user?.email).toBe('token@example.com')
    })

    test('returns null for invalid token', async () => {
      const user = await AuthService.getUserFromToken('invalid-token')

      expect(user).toBeNull()
    })

    test('returns null for token with non-existent user', async () => {
      const token = await AuthService.generateJWTAsync('non-existent-user-id')

      const user = await AuthService.getUserFromToken(token)

      expect(user).toBeNull()
    })
  })

  describe('Password Authentication', () => {
    test('registers user with password', async () => {
      const email = 'register@example.com'
      const password = 'securePassword123'
      const name = 'New User'

      const response = await AuthService.registerWithPassword(email, password, name)

      expect(response.user).toBeDefined()
      expect(response.user.email).toBe(email)
      expect(response.user.name).toBe(name)
      expect(response.token).toBeDefined()
    })

    test('signs in user with correct password', async () => {
      const email = 'signin@example.com'
      const password = 'myPassword123'

      // First register
      await AuthService.registerWithPassword(email, password, 'Test User')

      // Then sign in
      const response = await AuthService.signInWithPassword(email, password)

      expect(response.user).toBeDefined()
      expect(response.user.email).toBe(email)
      expect(response.token).toBeDefined()
    })

    test('rejects sign in with incorrect password', async () => {
      const email = 'wrongpass@example.com'
      const correctPassword = 'correctPassword'
      const wrongPassword = 'wrongPassword'

      // Register with correct password
      await AuthService.registerWithPassword(email, correctPassword)

      // Try to sign in with wrong password
      await expect(
        AuthService.signInWithPassword(email, wrongPassword)
      ).rejects.toThrow()
    })

    test('rejects sign in with non-existent email', async () => {
      await expect(
        AuthService.signInWithPassword('nonexistent@example.com', 'password')
      ).rejects.toThrow()
    })

    test('prevents duplicate email registration', async () => {
      const email = 'duplicate@example.com'
      const password = 'password123'

      await AuthService.registerWithPassword(email, password, 'User 1')

      await expect(
        AuthService.registerWithPassword(email, password, 'User 2')
      ).rejects.toThrow()
    })
  })
})
