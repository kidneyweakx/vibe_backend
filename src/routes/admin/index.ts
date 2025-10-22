import { Elysia } from 'elysia'
import { adminMiddleware } from '../../middlewares/admin'
import { getEnvVar } from '../../env'
import { adminPhotosRoute } from './photos'
import { adminRankingsRoute } from './rankings'
import { adminEventListRoute } from './eventList'
import { adminEventDeleteRoute } from './eventDelete'
import { adminEventUploadRoute } from './eventUpload'
import { adminEventEditRoute } from './eventEdit'
import { moderatePhotoRoute } from './moderatePhoto'
import { backfillRoutes } from './backfill'
import { adminTagRoutes } from './tags'

/**
 * Admin module with hybrid security model:
 * - Local: Full access (read + write)
 * - Cloudflare: Read-only with ADMIN_API_KEY
 */
export const adminModule = new Elysia({ prefix: '/admin' })
  // Hard guard: require X-Admin-Key for ALL admin routes (defense in depth)
  .onBeforeHandle(({ headers, set }: any) => {
    const adminKey = headers['x-admin-key'] || headers['X-Admin-Key']
    const expectedKey = getEnvVar('ADMIN_API_KEY')
    if (!expectedKey || !adminKey || adminKey !== expectedKey) {
      set.status = 403
      return { success: false, error: 'Admin access forbidden' }
    }
  })
  .use(adminMiddleware)
  .use(adminPhotosRoute)
  .use(adminRankingsRoute)
  .use(adminEventListRoute)
  .use(adminEventDeleteRoute)
  .use(adminEventUploadRoute)
  .use(adminEventEditRoute)
  .use(moderatePhotoRoute)
  .use(backfillRoutes)
  .use(adminTagRoutes)
