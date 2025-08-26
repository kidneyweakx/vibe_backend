import { Elysia, t } from 'elysia'
import { UserService } from '../../modules/user/service'
import { AuthService } from '../../modules/auth/service'

export const profileCreateRoute = new Elysia()
  .post('/profile/create', async ({ body, set }) => {
    try {
      const {
        customUserID,
        providerUserID,
        profileImageURL,
        email,
        authProvider,
        gender,
        displayName
      } = body as {
        customUserID?: string
        providerUserID: string
        profileImageURL?: string | null
        email: string
        authProvider: 'guest' | 'google' | 'apple' | 'password' | 'test'
        gender?: string
        displayName?: string
      }

      const user = await UserService.upsertUser({
        email,
        name: displayName,
        avatar: profileImageURL || undefined,
        gender,
        provider: authProvider,
        providerId: providerUserID || email
      })

      const token = await AuthService.generateJWTAsync(user.id)

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name || '',
          email: user.email,
          profileImageURL: user.avatar ?? undefined
        },
        token
      }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      customUserID: t.Optional(t.String()),
      providerUserID: t.String(),
      profileImageURL: t.Optional(t.Nullable(t.String())),
      email: t.String(),
      authProvider: t.Union([
        t.Literal('guest'),
        t.Literal('google'),
        t.Literal('apple'),
        t.Literal('password'),
        t.Literal('test')
      ]),
      gender: t.Optional(t.String()),
      displayName: t.Optional(t.String())
    })
  })


