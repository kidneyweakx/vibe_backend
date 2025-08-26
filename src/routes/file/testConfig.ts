import { Elysia } from 'elysia'
import { testR2Config } from './service'

export const testConfigRoute = new Elysia()
  .get('/test-config', async ({ set }) => {
    const result = await testR2Config()
    if (!result.success) set.status = 500
    return result
  })


