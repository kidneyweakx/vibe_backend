import { Elysia } from 'elysia'
import { requireAuth } from '../../middlewares/auth'
import { photoRoutes } from './photoRoutes'
import { reportRoute } from './report'

const protectedFileRoutes = requireAuth(new Elysia())
  .use(photoRoutes)  // Consolidated photo operations
  .use(reportRoute)  // POST /report

export const fileModule = new Elysia({ prefix: '/file' })
  .use(protectedFileRoutes)