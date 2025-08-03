import { UserService } from '../user/service'

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

export class AuthService {
  static async verifyGoogleToken(token: string): Promise<GoogleTokenPayload | null> {
    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${token}`)
      
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

  // @TODO: not full version
  static async verifyAppleToken(identityToken: string): Promise<AppleTokenPayload | null> {
    try {
      const payload = JSON.parse(atob(identityToken.split('.')[1]))
      
      if (!payload.sub || !payload.email) {
        return null
      }

      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name
      }
    } catch (error) {
      console.error('Apple token verification failed:', error)
      return null
    }
  }

  static async signInWithGoogle(token: string) {
    const payload = await this.verifyGoogleToken(token)
    
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

    return user
  }

  static async signInWithApple(identityToken: string) {
    const payload = await this.verifyAppleToken(identityToken)
    
    if (!payload) {
      throw new Error('Invalid Apple token')
    }

    const user = await UserService.upsertUser({
      email: payload.email,
      name: payload.name,
      provider: 'apple',
      providerId: payload.sub
    })

    return user
  }
}