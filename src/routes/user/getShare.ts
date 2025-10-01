import { Elysia } from 'elysia'
import { UserService } from '../../services/user/serviceAdapter'

export const getShareRoute = new Elysia()
  .get('/share/:id', async ({ params: { id }, set }) => {
    try {
      const shareData = await UserService.generateShareableLink(id)
      return { success: true, data: shareData }
    } catch (error: any) {
      set.status = 404
      return { success: false, error: error.message }
    }
  })


