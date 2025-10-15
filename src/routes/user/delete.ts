import { Elysia } from 'elysia'
import getPrisma from '../../dbConfig'
import { requireAuth } from '../../middlewares/auth'
import { deleteFile } from '../../services/file'
import { UserService } from '../../services/user/serviceAdapter'
import { invalidateUserCache } from '../../services/rate/getRandomPhotosV2'

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
      const photos = await prisma.photo.findMany({
        where: { userId: user.id },
        select: { id: true, key: true }
      })

      // Delete R2 objects for each photo (best-effort)
      for (const photo of photos) {
        const result = await deleteFile(photo.key)
        if (!result.success) {
          console.warn(`Failed to delete R2 object for photo ${photo.id}:`, result.error)
        }
      }

      // If avatar field stores an R2 key, attempt to delete it as well
      if (user.avatar) {
        const avatarDeletion = await deleteFile(user.avatar)
        if (!avatarDeletion.success) {
          console.warn(`Failed to delete avatar R2 object:`, avatarDeletion.error)
        }
      }

      // Soft-delete user and cascade related records
      await UserService.deleteUser(user.id)

      // Clear recommendation caches for this user
      invalidateUserCache(user.id)

      return { success: true, message: 'Account deleted successfully' }
    } catch (error: any) {
      console.error('Delete account error:', error)
      set.status = 500
      return { success: false, error: error.message || 'Failed to delete account' }
    }
  })


