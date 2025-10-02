import { Elysia } from 'elysia'
import { requireAuth } from '../../middlewares/auth'
import { homeInfoRoute } from './homeInfo'
import { journeyInfoRoute } from './journeyInfo'
import { profileInfoRoute } from './profileInfo'

export const infoModule = requireAuth(new Elysia({ prefix: '/info' }))
  .use(homeInfoRoute) // GET /homeInfo - General home info
  .use(journeyInfoRoute) // GET /journeyInfo/:userId
  .use(profileInfoRoute) // GET /profileInfo/:userId


