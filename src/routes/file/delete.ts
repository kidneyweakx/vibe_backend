import { Elysia } from 'elysia'
import { deleteFile } from './service'

export const deleteFileRoute = new Elysia()
  .delete('/:key', async ({ params, set }) => {
    const result = await deleteFile(params.key)
    if (!result.success) {
      set.status = 404
      return { success: false, error: result.error }
    }
    return { success: true }
  })


