import { Elysia, t } from 'elysia'
import getPrisma from '../../dbConfig'
import { upsertUser } from '../../services/user'
import { AuthService } from '../../services/auth/service'

export const onboardingRoute = new Elysia()
  .post('/complete', async ({ body, set }) => {
    try {
      const {
        account = {}, auth, demographics, questionnaire, consent, client
      } = body as any

      if (!auth?.provider || !auth?.providerUserID) {
        set.status = 400
        return { success: false, error: 'Missing auth.provider/providerUserID' }
      }

      const email = auth.email || `${auth.providerUserID}@${auth.provider}.local`

      const user = await upsertUser({
        email,
        name: account.displayName,
        avatar: account.avatarUrl, // expect a key if using R2 key
        gender: demographics?.gender,
        provider: auth.provider,
        providerId: auth.providerUserID
      })

      // Update optional profile fields
      await getPrisma().user.update({ where: { id: user.id }, data: {
        language: client?.locale,
        timezone: client?.timezone,
        notificationsEnabled: questionnaire?.notificationsEnabled ?? false
      } })

      // Upsert onboarding record
      await getPrisma().onboarding.upsert({
        where: { userId: user.id },
        update: {
          ageRange: demographics?.ageRange,
          vibeLevel: Number(questionnaire?.vibeLevel || 0),
          timeInvestmentHours: Number(questionnaire?.timeInvestmentHours || 0),
          notificationsEnabled: !!questionnaire?.notificationsEnabled,
          tosVersion: consent?.tosVersion || 'unknown',
          privacyVersion: consent?.privacyVersion || 'unknown',
          acceptedAt: consent?.acceptedAt ? new Date(consent.acceptedAt) : new Date()
        },
        create: {
          userId: user.id,
          ageRange: demographics?.ageRange || 'unknown',
          vibeLevel: Number(questionnaire?.vibeLevel || 0),
          timeInvestmentHours: Number(questionnaire?.timeInvestmentHours || 0),
          notificationsEnabled: !!questionnaire?.notificationsEnabled,
          tosVersion: consent?.tosVersion || 'unknown',
          privacyVersion: consent?.privacyVersion || 'unknown',
          acceptedAt: consent?.acceptedAt ? new Date(consent.acceptedAt) : new Date()
        }
      })

      const token = await AuthService.generateJWTAsync(user.id)

      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          gender: user.gender
        }
      }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      account: t.Optional(t.Object({
        customUserID: t.Optional(t.String()),
        displayName: t.Optional(t.String()),
        avatarUrl: t.Optional(t.String())
      })),
      auth: t.Object({
        provider: t.String(),
        providerUserID: t.String(),
        email: t.Optional(t.String())
      }),
      demographics: t.Optional(t.Object({
        gender: t.Optional(t.Union([t.Literal('male'), t.Literal('female'), t.Literal('other')])),
        ageRange: t.Optional(t.String())
      })),
      questionnaire: t.Optional(t.Object({
        vibeLevel: t.Optional(t.Integer()),
        timeInvestmentHours: t.Optional(t.Integer()),
        notificationsEnabled: t.Optional(t.Boolean())
      })),
      consent: t.Optional(t.Object({
        tosVersion: t.Optional(t.String()),
        privacyVersion: t.Optional(t.String()),
        acceptedAt: t.Optional(t.String())
      })),
      client: t.Optional(t.Object({
        locale: t.Optional(t.String()),
        timezone: t.Optional(t.String()),
        appVersion: t.Optional(t.String())
      }))
    })
  })


