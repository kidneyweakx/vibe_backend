import { Elysia, t } from 'elysia'
import getPrisma from '../../dbConfig'
import { getAllTags, getTagsByCategory } from '../../services/tag'

export const getAllTagsRoute = new Elysia()
  .get('/', async ({ query, set }) => {
    try {
      const tags = query.category
        ? await getTagsByCategory(getPrisma(), query.category as string)
        : await getAllTags(getPrisma())
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


