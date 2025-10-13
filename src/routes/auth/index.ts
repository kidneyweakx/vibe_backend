import { Elysia } from 'elysia'
import { googleVerifyRoute } from './googleVerify'
import { appleVerifyRoute } from './appleVerify'
import { guestSignInRoute } from './guestSignIn'
import { profileCreateRoute } from './profileCreate'
import { signoutRoute } from './signout'

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(googleVerifyRoute)
  .use(appleVerifyRoute)
  .use(guestSignInRoute)
  .use(profileCreateRoute)
  .use(signoutRoute)
