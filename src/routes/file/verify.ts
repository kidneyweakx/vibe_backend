import { Elysia } from 'elysia'
import { verifyFile } from './service'

export const verifyRoute = new Elysia()
  .get('/verify/:key', async ({ params }) => {
    const exists = await verifyFile(params.key)
    return { success: true, exists }
  })


