import { Elysia } from 'elysia'
import getPrisma from '../../dbConfig'
import { upsertUser } from '../../services/user'
import { AuthService } from '../../services/auth/service'

// Create logger for this module
const logger = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [OnboardingComplete] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  warn: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [OnboardingComplete] WARN: ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [OnboardingComplete] ERROR: ${message}`, error ? JSON.stringify(error, null, 2) : '');
  }
};

export const onboardingRoute = new Elysia()
  .post('/complete', async ({ body, set }) => {
    const startTime = Date.now();
    
    logger.info('Onboarding completion request started', {
      hasBody: !!body,
      bodyType: typeof body
    });
    
    try {
      const {
        account = {}, auth, demographics, questionnaire, consent, client
      } = body as any

      logger.info('Request body parsed', {
        hasAccount: !!account,
        hasAuth: !!auth,
        hasDemographics: !!demographics,
        hasQuestionnaire: !!questionnaire,
        hasConsent: !!consent,
        hasClient: !!client
      });

      if (!body || typeof body !== 'object') {
        logger.warn('Invalid request body');
        set.status = 400
        return { success: false, error: 'Invalid JSON body' }
      }

      if (!auth?.provider || !auth?.providerUserID) {
        logger.warn('Missing required auth fields', {
          hasProvider: !!auth?.provider,
          hasProviderUserID: !!auth?.providerUserID
        });
        set.status = 400
        return { success: false, error: 'Missing auth.provider/providerUserID' }
      }

      const email = auth.email || `${auth.providerUserID}@${auth.provider}.local`
      
      logger.info('Starting user upsert', {
        provider: auth.provider,
        providerUserID: auth.providerUserID,
        email,
        displayName: account.displayName,
        gender: demographics?.gender
      });

      const user = await upsertUser({
        email,
        name: account.displayName,
        avatar: account.avatarUrl, // expect a key if using R2 key
        gender: demographics?.gender,
        provider: auth.provider,
        providerId: auth.providerUserID
      });

      logger.info('User upsert completed, updating profile fields', {
        userId: user.id,
        language: client?.locale,
        timezone: client?.timezone,
        notificationsEnabled: questionnaire?.notificationsEnabled ?? false
      });

      // Update optional profile fields
      await getPrisma().user.update({ where: { id: user.id }, data: {
        language: client?.locale,
        timezone: client?.timezone,
        notificationsEnabled: questionnaire?.notificationsEnabled ?? false
      } })

      logger.info('Profile fields updated, creating onboarding record', {
        userId: user.id,
        ageRange: demographics?.ageRange,
        vibeLevel: questionnaire?.vibeLevel,
        timeInvestmentHours: questionnaire?.timeInvestmentHours
      });

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

      logger.info('Onboarding record created, generating JWT token', {
        userId: user.id
      });

      const token = await AuthService.generateJWTAsync(user.id)

      const duration = Date.now() - startTime;
      logger.info('Onboarding completion successful', {
        userId: user.id,
        duration: `${duration}ms`,
        hasToken: !!token
      });

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
      const duration = Date.now() - startTime;
      logger.error('Onboarding completion failed', {
        duration: `${duration}ms`,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      
      set.status = 400
      return { success: false, error: error.message }
    }
  })


