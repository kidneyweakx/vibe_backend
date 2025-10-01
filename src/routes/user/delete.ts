import { Elysia } from 'elysia'
import getPrisma from '../../dbConfig'
import { requireAuth } from '../../middlewares/auth'
import { deleteFile } from '../../services/file'

export const deleteAccountRoute = new Elysia()
  .use(requireAuth)
  .delete('/delete', async (ctx) => {
    const { user, set } = ctx as any
    try {
      // Fetch all user photos first (keys needed for R2 deletion)
      const photos = await getPrisma().photo.findMany({ where: { userId: user.id } })

      // Delete R2 objects for each photo (best-effort)
      for (const photo of photos) {
        try {
          await deleteFile(photo.key)
        } catch (e) {
          // continue even if one deletion fails; DB cascades will still remove records
        }
      }

      // If avatar field stores an R2 key, attempt to delete it as well
      if (user.avatar) {
        try { await deleteFile(user.avatar) } catch {}
      }

      // Delete the user; Prisma schema cascades will remove related rows
      await getPrisma().user.delete({ where: { id: user.id } })

      return { success: true }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  })


