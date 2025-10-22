import { Elysia } from 'elysia'
import { getEnvVar } from '../env'
import { isLocal } from '../utils/runtime'

/**
 * Admin middleware - validates admin access
 *
 * Two-tier security:
 * 1. All environments require ADMIN_API_KEY via x-admin-key header
 * 2. Local environment: valid key allows read + write
 * 3. Cloudflare environment: valid key allows read-only
 */
export const adminMiddleware = new Elysia()
  .derive(({ headers, set }: any) => {
    const adminKey = headers['x-admin-key'] || headers['X-Admin-Key']
    const expectedKey = getEnvVar('ADMIN_API_KEY')
    const local = isLocal()

    // Require admin key in all environments
    if (!expectedKey || !adminKey || adminKey !== expectedKey) {
      set.status = 403
      throw new Error('Admin access forbidden')
    }

    return {
      isAdmin: true,
      isLocal: local,
      canWrite: local // Only local environment can write
    }
  })

/**
 * Require write permission (local only)
 */
export const requireWritePermission = new Elysia()
  .derive(({ set }) => {
    const local = isLocal()

    if (!local) {
      set.status = 403
      throw new Error('Write operations only available in local environment')
    }

    return { canWrite: true }
  })
