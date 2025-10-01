import { Elysia } from 'elysia'
import { requireAuth } from '../../middlewares/auth'
import { homeInfoRoute } from './homeInfo'
import { journeyInfoRoute } from './journeyInfo'
import { profileInfoRoute } from './profileInfo'

export const infoModule = new Elysia({ prefix: '/info' })
  .use(requireAuth)
  .use(homeInfoRoute) // GET /homeInfo - General home info
  .use(journeyInfoRoute) // GET /journeyInfo/:userId
  .use(profileInfoRoute) // GET /profileInfo/:userId


