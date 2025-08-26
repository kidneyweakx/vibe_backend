import { Elysia, t } from 'elysia'
import { ratePhoto, getUserStats, getRankingList, getRandomPhotosForRating } from './service'

export const rateModule = new Elysia({ prefix: '/rate' })
  // 評分照片
  .post('/photo', async ({ body, set }) => {
    try {
      const { raterId, photoId, type } = body as { raterId: string; photoId: string; type: 'like' | 'normal' }
      
      if (!raterId || !photoId || !type) {
        set.status = 400
        return { success: false, error: 'raterId, photoId and type are required' }
      }
      
      const result = await ratePhoto(raterId, photoId, type)
      return result
    } catch (error: any) {
      console.error('Rate photo error:', error)
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      raterId: t.String(),
      photoId: t.String(),
      type: t.Union([t.Literal('like'), t.Literal('normal')])
    })
  })
  
  // 獲取用戶統計和排名
  .get('/user/:userId/stats', async ({ params, set }) => {
    try {
      const result = await getUserStats(params.userId)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('Get user stats error:', error)
      set.status = 400
      return { success: false, error: error.message }
    }
  })
  
  // 獲取排行榜
  .get('/rankings', async ({ query, set }) => {
    try {
      const limit = parseInt(query.limit as string) || 50
      const result = await getRankingList(limit)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('Get rankings error:', error)
      set.status = 500
      return { success: false, error: error.message }
    }
  })
  
  // 獲取隨機照片用於評分
  .get('/photos/random', async ({ query, set }) => {
    try {
      const userId = query.userId as string
      const limit = parseInt(query.limit as string) || 10
      
      if (!userId) {
        set.status = 400
        return { success: false, error: 'userId is required' }
      }
      
      const photos = await getRandomPhotosForRating(userId, limit)
      return { success: true, data: photos }
    } catch (error: any) {
      console.error('Get random photos error:', error)
      set.status = 500
      return { success: false, error: error.message }
    }
  })