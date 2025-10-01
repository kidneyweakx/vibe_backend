import { Elysia } from 'elysia'
import { googleVerifyRoute } from './googleVerify'
import { appleVerifyRoute } from './appleVerify'
import { passwordVerifyRoute } from './passwordVerify'
import { profileCreateRoute } from './profileCreate'
import { signoutRoute } from './signout'
import { legacyAuthRoutes } from './legacy'

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(legacyAuthRoutes)
  .use(googleVerifyRoute)
  .use(appleVerifyRoute)
  .use(passwordVerifyRoute)
  .use(profileCreateRoute)
  .use(signoutRoute)
