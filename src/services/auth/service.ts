import { UserService } from '../user/serviceAdapter'
import * as jose from 'jose'
import bcrypt from 'bcryptjs'
import getPrisma from '../../dbConfig'

export interface GoogleTokenPayload {
  sub: string // Google user ID
  email: string
  name?: string
  picture?: string
}

export interface AppleTokenPayload {
  sub: string // Apple user ID
  email: string
  name?: string
}

export interface AuthResponse {
  success?: boolean
  user: {
    id: string
    name: string
    email: string
    isGuest?: boolean
    profileImageURL?: string
    avatar?: string | null
    provider?: string | null
    providerId?: string | null
    onboardedAt?: string | null
  }
  token?: string
  needsOnboarding: boolean
}

export interface AppleSignInData {
  idToken: string
  nonce: string
  userIdentifier: string
  email?: string
  fullName?: {
    givenName?: string
    familyName?: string
  }
}

export class AuthService {
  private static readonly JWT_SECRET = (() => {
    const secret = process.env.JWT_SECRET
    if (!secret || secret === 'your-secret-key') {
      console.warn('⚠️  WARNING: Using default JWT_SECRET. Set JWT_SECRET environment variable in production!')
    }
    return secret || 'your-secret-key'
  })()
  private static readonly JWT_EXPIRES_IN_SECONDS = '30d' // 30 days token expiration
  private static readonly BCRYPT_SALT_ROUNDS = 10

  private static describeDbConfigIssue(): string {
    const hasWorkerBinding = Boolean((globalThis as any)?.__ENV?.DB)
    const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)
    if (hasWorkerBinding || hasDatabaseUrl) {
      return 'unexpected database error'
    }
    return 'database unavailable: ensure env.DB is bound or DATABASE_URL=file:./dev.db is set'
  }

  private static logEnvDiagnostics(provider: string, extra?: Record<string, unknown>) {
    console.error('auth:diagnostics', {
      provider,
      workerDbBinding: (globalThis as any)?.__ENV?.DB ? 'present' : 'missing',
      databaseUrl: process.env.DATABASE_URL ? 'present' : 'missing',
      jwtSecret: process.env.JWT_SECRET ? 'present' : 'missing',
      ...extra
    })
  }

  static generateJWT(userId: string): string {
    // jose produces Uint8Array key; we return compact JWS string synchronously is not supported.
    // Provide a synchronous wrapper by using a precomputed key and a blocking wait is not possible; make async instead.
    // To preserve API, we use a small synchronous fallback via atob which is not possible either.
    // Change API to async and update callers accordingly.
    throw new Error('generateJWT should not be called synchronously. Use generateJWTAsync instead.')
  }

  static async generateJWTAsync(userId: string | number): Promise<string> {
    const secret = new TextEncoder().encode(this.JWT_SECRET)
    const alg = 'HS256'
    const jwt = await new jose.SignJWT({ userId: String(userId) })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setExpirationTime(this.JWT_EXPIRES_IN_SECONDS)
      .sign(secret)
    return jwt
  }

  static formatAuthResponse(user: any, token?: string): AuthResponse {
    const onboardedAtValue = user?.onboardedAt ?? null
    const onboardedAt = onboardedAtValue
      ? typeof onboardedAtValue === 'string'
        ? onboardedAtValue
        : new Date(onboardedAtValue).toISOString()
      : null

    const idValue = user?.id
    const id = typeof idValue === 'string' ? idValue : String(idValue)

    return {
      success: true,
      token,
      needsOnboarding: !onboardedAt,
      user: {
        id,
        name: user?.name ?? '',
        email: user?.email ?? '',
        isGuest: user?.isGuest ?? false,
        profileImageURL: user?.avatar ?? undefined,
        avatar: user?.avatar ?? null,
        provider: user?.provider ?? null,
        providerId: user?.providerId ?? null,
        onboardedAt
      }
    }
  }

  static async verifyJWTAsync(token: string): Promise<{ userId: string } | null> {
    try {
      const secret = new TextEncoder().encode(this.JWT_SECRET)
      const { payload } = await jose.jwtVerify(token, secret)
      const userIdValue = payload.userId
      if (typeof userIdValue === 'string' && userIdValue.trim().length > 0) {
        return { userId: userIdValue }
      }
      if (typeof userIdValue === 'number' && Number.isFinite(userIdValue)) {
        return { userId: String(userIdValue) }
      }
      return null
    } catch {
      return null
    }
  }

  static async hashPassword(password: string): Promise<string> {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long')
    }
    return bcrypt.hash(password, this.BCRYPT_SALT_ROUNDS)
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!hash) return false
    return bcrypt.compare(password, hash)
  }

  static async registerWithPassword(email: string, password: string, name?: string): Promise<AuthResponse> {
    const prisma = getPrisma()

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw new Error('Email already registered')
    }

    const passwordHash = await this.hashPassword(password)

    const user = await prisma.user.create({
      data: {
        email,
        name: name ?? null,
        provider: 'password',
        providerId: email,
        passwordHash,
        isGuest: false
      }
    })

    const token = await this.generateJWTAsync(user.id)

    return AuthService.formatAuthResponse(user, token)
  }

  static async signInWithPassword(email: string, password: string): Promise<AuthResponse> {
    const prisma = getPrisma()

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user || !user.passwordHash) {
      throw new Error('Invalid email or password')
    }

    const isValid = await this.verifyPassword(password, user.passwordHash)
    if (!isValid) {
      throw new Error('Invalid email or password')
    }

    const token = await this.generateJWTAsync(user.id)

    return AuthService.formatAuthResponse(user, token)
  }

  static async verifyGoogleToken(idToken: string, accessToken?: string): Promise<GoogleTokenPayload | null> {
    try {
      // Use ID token for verification (more secure)
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`)
      
      if (!response.ok) {
        return null
      }

      const payload = await response.json()
      
      if (!payload.sub || !payload.email) {
        return null
      }

      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture
      }
    } catch (error) {
      console.error('Google token verification failed:', error)
      return null
    }
  }

  static async verifyAppleToken(data: AppleSignInData): Promise<AppleTokenPayload | null> {
    try {
      // Basic JWT decode for base64url (no signature verify here)
      const [, payloadB64Url] = data.idToken.split('.')
      if (!payloadB64Url) return null
      const padded = payloadB64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payloadB64Url.length / 4) * 4, '=')
      const binary = atob(padded)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const payload = JSON.parse(new TextDecoder().decode(bytes))
      
      if (!payload.sub) {
        return null
      }

      // Construct name from fullName if provided
      let name = undefined
      if (data.fullName?.givenName || data.fullName?.familyName) {
        name = [data.fullName.givenName, data.fullName.familyName]
          .filter(Boolean)
          .join(' ')
      }

      // Some Apple flows only provide email on the very first sign-in.
      // If missing, we will synthesize later using sub.
      return {
        sub: payload.sub,
        email: data.email || payload.email,
        name: name
      }
    } catch (error) {
      console.error('Apple token verification failed:', error)
      return null
    }
  }

  // Guest authentication - device-based, no password needed
  static async signInAsGuest(deviceId: string): Promise<AuthResponse> {
    try {
      // Try to find existing guest user with this deviceId
      const existingUser = await UserService.getUserByDeviceId(deviceId)

      let user
      if (existingUser && !existingUser.isDeleted) {
        // Return existing guest user
        user = existingUser
      } else {
        // Create new guest user
        user = await UserService.createGuestUser(deviceId)
      }

      const token = await this.generateJWTAsync(user.id)

      return AuthService.formatAuthResponse(user, token)
    } catch (error: any) {
      this.logEnvDiagnostics('guest', { error: String(error?.message || error), deviceId })
      throw new Error(`Guest authentication failed: ${this.describeDbConfigIssue()}`)
    }
  }

  static async signInWithGoogle(idToken: string, accessToken?: string): Promise<AuthResponse> {
    const payload = await this.verifyGoogleToken(idToken, accessToken)
    
    if (!payload) {
      throw new Error('Invalid Google token')
    }

    let user
    try {
      user = await UserService.upsertUser({
        email: payload.email,
        name: payload.name,
        avatar: payload.picture,
        provider: 'google',
        providerId: payload.sub
      })
    } catch (error: any) {
      this.logEnvDiagnostics('google', { error: String(error?.message || error) })
      throw new Error(`Authentication failed: ${this.describeDbConfigIssue()}`)
    }

    const token = await this.generateJWTAsync(user.id)

    return AuthService.formatAuthResponse(user, token)
  }

  static async signInWithApple(data: AppleSignInData): Promise<AuthResponse> {
    const payload = await this.verifyAppleToken(data)

    if (!payload) {
      throw new Error('Invalid Apple token')
    }

    // Ensure we always provide a valid, unique email.
    // Apple may not include email except on first authorization; synthesize a stable placeholder.
    const safeEmail = payload.email && payload.email.trim().length > 0
      ? payload.email
      : `${payload.sub}@apple.local`

    let user
    try {
      // Check if user exists first to preserve their chosen name
      const existingUser = await UserService.getUserByProvider('apple', payload.sub)

      if (existingUser) {
        // User exists - don't override their name with 'Apple User'
        user = await UserService.upsertUser({
          email: safeEmail,
          name: existingUser.name, // Keep existing name
          provider: 'apple',
          providerId: payload.sub
        })
      } else {
        // New user - use provided name or let them set it later in onboarding
        user = await UserService.upsertUser({
          email: safeEmail,
          name: payload.name, // Don't default to 'Apple User' - let onboarding handle it
          provider: 'apple',
          providerId: payload.sub
        })
      }
    } catch (error: any) {
      this.logEnvDiagnostics('apple', { error: String(error?.message || error) })
      throw new Error(`Authentication failed: ${this.describeDbConfigIssue()}`)
    }

    const token = await this.generateJWTAsync(user.id)

    return AuthService.formatAuthResponse(user, token)
  }


  static async getUserFromToken(token: string) {
    const decoded = await this.verifyJWTAsync(token)
    if (!decoded) {
      return null
    }

    const userId = decoded.userId
    if (!userId || typeof userId !== 'string') {
      return null
    }

    return UserService.getUserById(userId)
  }
}