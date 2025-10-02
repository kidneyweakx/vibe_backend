import { Elysia } from 'elysia'
import getPrisma from '../../dbConfig'
import { requireAuth } from '../../middlewares/auth'
import { deleteFile } from '../../services/file'

export const deleteAccountRoute = new Elysia()
  .use(requireAuth)
  .delete('/delete', async (ctx) => {
    const { user, set } = ctx as any

    try {
      if (!user) {
        set.status = 401
        return { success: false, error: 'User not authenticated' }
      }

      const prisma = getPrisma()

      // Fetch all user photos first (keys needed for R2 deletion)
      const photos = await prisma.photo.findMany({ where: { userId: user.id } })

      // Delete R2 objects for each photo (best-effort)
      for (const photo of photos) {
        try {
          await deleteFile(photo.key)
        } catch (e) {
          console.warn(`Failed to delete R2 object for photo ${photo.id}:`, e)
          // continue even if one deletion fails; DB cascades will still remove records
        }
      }

      // If avatar field stores an R2 key, attempt to delete it as well
      if (user.avatar) {
        try {
          await deleteFile(user.avatar)
        } catch (e) {
          console.warn(`Failed to delete avatar R2 object:`, e)
        }
      }

      // Delete the user; Prisma schema cascades will remove related rows
      await prisma.user.delete({ where: { id: user.id } })

      return { success: true, message: 'Account deleted successfully' }
    } catch (error: any) {
      console.error('Delete account error:', error)
      set.status = 500
      return { success: false, error: error.message || 'Failed to delete account' }
    }
  })


