import { Elysia } from 'elysia'
import { getEnvVar } from '../env'
import { isLocal } from '../utils/runtime'

/**
 * Admin middleware - validates admin access
 *
 * Two-tier security:
 * 1. Local environment: Full access (read + write operations)
 * 2. Cloudflare environment: Requires ADMIN_API_KEY (read-only operations)
 */
export const adminMiddleware = new Elysia()
  .derive(({ headers, set }: any) => {
    const adminKey = headers['x-admin-key'] || headers['X-Admin-Key']
    const expectedKey = getEnvVar('ADMIN_API_KEY')
    const local = isLocal()

    // Local environment: full access without key
    if (local) {
      return {
        isAdmin: true,
        isLocal: true,
        canWrite: true
      }
    }

    // Cloudflare environment: requires admin key for read-only access
    if (!expectedKey || !adminKey || adminKey !== expectedKey) {
      set.status = 403
      throw new Error('Admin access forbidden')
    }

    return {
      isAdmin: true,
      isLocal: false,
      canWrite: false // Cloudflare can only read
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
