import { Elysia } from 'elysia'
import { onboardingRoute } from './complete'

export const onboardingModule = new Elysia({ prefix: '/onboarding' })
  .use(onboardingRoute)


