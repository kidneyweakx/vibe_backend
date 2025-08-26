import { Elysia, t } from 'elysia'
import { UserService } from './service'

export const user = new Elysia({ prefix: '/user' })
  // 獲取用戶完整資料（需要認證）
  .get('/profile/:id', async ({ params: { id }, set }) => {
    try {
      const user = await UserService.getUserById(id)
      if (!user) {
        set.status = 404
        return { success: false, error: 'User not found' }
      }
      return { success: true, data: user }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: 'Failed to get user profile' }
    }
  })

  // 獲取用戶公開信息（可分享）
  .get('/info/:id', async ({ params: { id }, set }) => {
    try {
      const userInfo = await UserService.getUserPublicInfo(id)
      return { success: true, data: userInfo }
    } catch (error: any) {
      console.error('Get user info error:', error)
      set.status = 404
      return { success: false, error: error.message }
    }
  })

  // 更新用戶資料
  .put('/profile/:id', async ({ params: { id }, body, set }) => {
    try {
      const user = await UserService.updateUser(id, body)
      return { success: true, data: user }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: 'Failed to update user' }
    }
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      avatar: t.Optional(t.String()),
      gender: t.Optional(t.Union([t.Literal('male'), t.Literal('female'), t.Literal('other')]))
    })
  })

  // 生成分享鏈接
  .get('/share/:id', async ({ params: { id }, set }) => {
    try {
      const shareData = await UserService.generateShareableLink(id)
      return { success: true, data: shareData }
    } catch (error: any) {
      console.error('Generate share link error:', error)
      set.status = 404
      return { success: false, error: error.message }
    }
  })

  // 生成QR碼（簡單的文本返回，前端可以用來生成QR碼）
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

      // 返回QR碼數據，前端可以用這個生成QR碼
      return { 
        success: true, 
        data: {
          qrText: JSON.stringify(qrData),
          displayUrl: qrData.url,
          userName: user.name
        }
      }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: 'Failed to generate QR code data' }
    }
  })

  // 創建測試用戶
  .post('/test', async ({ body, set }) => {
    try {
      const user = await UserService.createTestUser(body.email, body.name)
      return { success: true, data: user }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: `Failed to create test user: ${error.message}` }
    }
  }, {
    body: t.Object({
      email: t.String(),
      name: t.Optional(t.String())
    })
  })

  // 舊的API保持兼容性
  .get('/:id', async ({ params: { id } }) => {
    try {
      const user = await UserService.getUserById(id)
      if (!user) {
        return { error: 'User not found' }
      }
      return { user }
    } catch (error) {
      return { error: 'Failed to get user' }
    }
  })

  .put('/:id', async ({ params: { id }, body }) => {
    try {
      const user = await UserService.updateUser(id, body)
      return { user }
    } catch (error) {
      return { error: 'Failed to update user' }
    }
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      avatar: t.Optional(t.String())
    })
  })