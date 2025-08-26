import { Elysia, t } from 'elysia'
import { TagService } from './service'
import getPrisma from '../../dbConfig'

export const getAllTagsRoute = new Elysia()
  .get('/', async ({ query, set }) => {
    const tagService = new TagService(getPrisma())
    try {
      const tags = query.category
        ? await tagService.getTagsByCategory(query.category as string)
        : await tagService.getAllTags()
      return { success: true, data: tags }
    } catch (error) {
      console.error('獲取標籤失敗:', error)
      set.status = 500
      return { success: false, error: '獲取標籤失敗' }
    }
  }, {
    query: t.Object({
      category: t.Optional(t.String())
    })
  })


