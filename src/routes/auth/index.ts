import { Elysia } from 'elysia'
import { googleVerifyRoute } from './googleVerify'
import { appleVerifyRoute } from './appleVerify'
import { passwordVerifyRoute } from './passwordVerify'
import { passwordRegisterRoute } from './passwordRegister'
import { profileCreateRoute } from './profileCreate'
import { signoutRoute } from './signout'
import { verifyTokenRoute } from './verifyToken'
import { legacyAuthRoutes } from './legacy'

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(googleVerifyRoute)
  .use(profileCreateRoute)
  .use(appleVerifyRoute)
  .use(passwordVerifyRoute)
  .use(passwordRegisterRoute)
  .use(signoutRoute)
  .use(verifyTokenRoute)
  .use(legacyAuthRoutes)
