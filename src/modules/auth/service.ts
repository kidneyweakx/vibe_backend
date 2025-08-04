import { UserService } from '../user/service'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

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
  user: {
    id: string
    name: string
    email: string
    profileImageURL?: string
  }
  token?: string
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
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
  private static readonly JWT_EXPIRES_IN = '7d'

  static generateJWT(userId: string): string {
    return jwt.sign({ userId }, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRES_IN })
  }

  static verifyJWT(token: string): { userId: string } | null {
    try {
      return jwt.verify(token, this.JWT_SECRET) as { userId: string }
    } catch {
      return null
    }
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
      // Basic JWT decode - in production, you should verify the signature
      const payload = JSON.parse(atob(data.idToken.split('.')[1]))
      
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

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  static async signInWithGoogle(idToken: string, accessToken?: string): Promise<AuthResponse> {
    const payload = await this.verifyGoogleToken(idToken, accessToken)
    
    if (!payload) {
      throw new Error('Invalid Google token')
    }

    const user = await UserService.upsertUser({
      email: payload.email,
      name: payload.name,
      avatar: payload.picture,
      provider: 'google',
      providerId: payload.sub
    })

    const token = this.generateJWT(user.id)

    return {
      user: {
        id: user.id,
        name: user.name || '',
        email: user.email,
        profileImageURL: user.avatar
      },
      token
    }
  }

  static async signInWithApple(data: AppleSignInData): Promise<AuthResponse> {
    const payload = await this.verifyAppleToken(data)
    
    if (!payload) {
      throw new Error('Invalid Apple token')
    }

    const user = await UserService.upsertUser({
      email: payload.email,
      name: payload.name,
      provider: 'apple',
      providerId: payload.sub
    })

    const token = this.generateJWT(user.id)

    return {
      user: {
        id: user.id,
        name: user.name || '',
        email: user.email,
        profileImageURL: user.avatar
      },
      token
    }
  }

  static async signInWithPassword(username: string, password: string): Promise<AuthResponse> {
    // Find user by email or username
    const user = await UserService.getUserByEmail(username)
    
    if (!user || !user.passwordHash) {
      throw new Error('Invalid credentials')
    }

    const isValidPassword = await this.verifyPassword(password, user.passwordHash)
    
    if (!isValidPassword) {
      throw new Error('Invalid credentials')
    }

    const token = this.generateJWT(user.id)

    return {
      user: {
        id: user.id,
        name: user.name || '',
        email: user.email,
        profileImageURL: user.avatar
      },
      token
    }
  }

  static async registerWithPassword(email: string, password: string, name?: string): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await UserService.getUserByEmail(email)
    if (existingUser) {
      throw new Error('User already exists')
    }

    const passwordHash = await this.hashPassword(password)
    
    const user = await UserService.upsertUser({
      email,
      name,
      provider: 'password',
      providerId: email, // Use email as providerId for password auth
      passwordHash
    })

    const token = this.generateJWT(user.id)

    return {
      user: {
        id: user.id,
        name: user.name || '',
        email: user.email,
        profileImageURL: user.avatar
      },
      token
    }
  }

  static async getUserFromToken(token: string) {
    const decoded = this.verifyJWT(token)
    
    if (!decoded) {
      return null
    }

    return UserService.getUserById(decoded.userId)
  }
}