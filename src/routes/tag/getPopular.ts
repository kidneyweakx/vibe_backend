import { Elysia, t } from 'elysia'
import { TagService } from './service'
import getPrisma from '../../dbConfig'

export const getPopularTagsRoute = new Elysia()
  .get('/popular', async ({ query, set }) => {
    const tagService = new TagService(getPrisma())
    try {
      const tags = await tagService.getPopularTags((query.limit as number) || 10)
      return { success: true, data: tags }
    } catch (error) {
      console.error('獲取熱門標籤失敗:', error)
      set.status = 500
      return { success: false, error: '獲取熱門標籤失敗' }
    }
  }, {
    query: t.Object({
      limit: t.Optional(t.Number())
    })
  })


