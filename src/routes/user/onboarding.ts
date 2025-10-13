import { Elysia, t } from 'elysia'
import getPrisma from '../../dbConfig'
import { upsertUser } from '../../services/user'
import { AuthService } from '../../services/auth/service'

const logger = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [Onboarding] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [Onboarding] ERROR: ${message}`, error)
  }
}

export const onboardingRoute = new Elysia()
  .post('/onboard', async ({ body, set }: any) => {
    const startTime = Date.now()
    
    try {
      const {
        account = {},
        auth,
        demographics = {},
        questionnaire = {},
        consent = {},
        client = {}
      } = body

      logger.info('Onboarding request received', {
        hasAuth: !!auth,
        provider: auth?.provider,
        providerUserID: auth?.providerUserID
      })

      // Validate required fields
      if (!auth?.provider || !auth?.providerUserID) {
        logger.error('Missing required auth fields')
        set.status = 400
        return { success: false, error: 'Missing auth.provider/providerUserID' }
      }

      const email = auth.email || `${auth.providerUserID}@${auth.provider}.local`
      
      // Create or update user with all onboarding data
      const user = await upsertUser({
        email,
        name: account.displayName,
        avatar: account.avatarUrl,
        gender: demographics.gender,
        provider: auth.provider,
        providerId: auth.providerUserID,
        isGuest: auth.provider === 'guest'
      })

      // Update user with onboarding-specific data
      await getPrisma().user.update({
        where: { id: user.id },
        data: {
          // Profile data
          language: client.locale,
          timezone: client.timezone,
          
          // Onboarding data
          ageRange: demographics.ageRange,
          vibeLevel: Number(questionnaire.vibeLevel || 0),
          timeInvestmentHours: Number(questionnaire.timeInvestmentHours || 0),
          notificationsEnabled: !!questionnaire.notificationsEnabled,
          tosVersion: consent.tosVersion || 'v1',
          privacyVersion: consent.privacyVersion || 'v1',
          onboardedAt: consent.acceptedAt ? new Date(consent.acceptedAt) : new Date()
        }
      })

      // Generate JWT token
      const token = await AuthService.generateJWTAsync(user.id)

      const duration = Date.now() - startTime
      logger.info('Onboarding completed', {
        userId: user.id,
        duration: `${duration}ms`
      })

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
      const duration = Date.now() - startTime
      logger.error('Onboarding failed', {
        duration: `${duration}ms`,
        error: error.message
      })
      
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      auth: t.Object({
        provider: t.String(),
        providerUserID: t.String(),
        email: t.Optional(t.String())
      }),
      account: t.Optional(t.Object({
        displayName: t.Optional(t.String()),
        avatarUrl: t.Optional(t.String())
      })),
      demographics: t.Optional(t.Object({
        gender: t.Optional(t.String()),
        ageRange: t.Optional(t.String())
      })),
      questionnaire: t.Optional(t.Object({
        vibeLevel: t.Optional(t.Number()),
        timeInvestmentHours: t.Optional(t.Number()),
        notificationsEnabled: t.Optional(t.Boolean())
      })),
      consent: t.Optional(t.Object({
        tosVersion: t.Optional(t.String()),
        privacyVersion: t.Optional(t.String()),
        acceptedAt: t.Optional(t.String())
      })),
      client: t.Optional(t.Object({
        locale: t.Optional(t.String()),
        timezone: t.Optional(t.String())
      }))
    })
  })
