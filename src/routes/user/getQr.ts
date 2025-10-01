import { Elysia } from 'elysia'
import { UserService } from '../../services/user/serviceAdapter'

export const getQrRoute = new Elysia()
  .get('/qr/:id', async ({ params: { id }, set }) => {
    try {
      const user = await UserService.getUserById(id)
      if (!user) {
        set.status = 404
        return { success: false, error: 'User not found' }
      }
      const qrData = {
        type: 'user_profile',
        userId: id,
        url: `${process.env.FRONTEND_URL || 'https://vibe.app'}/user/${id}`,
        name: user.name
      }
      return { success: true, data: { qrText: JSON.stringify(qrData), displayUrl: qrData.url, userName: user.name } }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: 'Failed to generate QR code data' }
    }
  })


