import { Elysia } from 'elysia'
import { authMiddleware } from '../../middlewares/auth'
import { homeInfoRoute } from './homeInfo'
import { journeyInfoRoute } from './journeyInfo'
import { profileInfoRoute } from './profileInfo'

// Info endpoints are public - use optional authMiddleware instead of requireAuth
export const infoModule = new Elysia({ prefix: '/info' })
  .use(authMiddleware)
  .use(homeInfoRoute) // GET /homeInfo - General home info
  .use(journeyInfoRoute) // GET /journeyInfo/:userId
  .use(profileInfoRoute) // GET /profileInfo/:userId


