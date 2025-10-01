import { Elysia } from 'elysia'
import { UserService } from '../../services/user/serviceAdapter'

export const getInfoRoute = new Elysia()
  .get('/info/:id', async ({ params: { id }, set }) => {
    try {
      const userInfo = await UserService.getUserPublicInfo(id)
      return { success: true, data: userInfo }
    } catch (error: any) {
      set.status = 404
      return { success: false, error: error.message }
    }
  })


