import { Elysia } from 'elysia'
import { adminMiddleware } from '../../middlewares/admin'
import { adminPhotosRoute } from './photos'
import { adminRankingsRoute } from './rankings'
import { adminEventListRoute } from './eventList'
import { adminEventDeleteRoute } from './eventDelete'
import { adminEventUploadRoute } from './eventUpload'

/**
 * Admin module with hybrid security model:
 * - Local: Full access (read + write)
 * - Cloudflare: Read-only with ADMIN_API_KEY
 */
export const adminModule = new Elysia({ prefix: '/admin' })
  .use(adminMiddleware)
  .use(adminPhotosRoute)
  .use(adminRankingsRoute)
  .use(adminEventListRoute)
  .use(adminEventDeleteRoute)
  .use(adminEventUploadRoute)
