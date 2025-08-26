import { Elysia, t } from 'elysia'
import { TagService } from './service'
import getPrisma from '../../dbConfig'

export const createTagRoute = new Elysia()
  .post('/', async ({ body, set }) => {
    const tagService = new TagService(getPrisma())
    try {
      const tag = await tagService.createTag(body as any)
      return { success: true, data: tag }
    } catch (error) {
      console.error('創建標籤失敗:', error)
      set.status = 500
      return { success: false, error: '創建標籤失敗' }
    }
  }, {
    body: t.Object({
      name: t.String({ minLength: 1 }),
      displayName: t.String({ minLength: 1 }),
      emoji: t.Optional(t.String()),
      color: t.Optional(t.String({ pattern: '^#[0-9A-Fa-f]{6}$' })),
      category: t.Optional(t.String())
    })
  })


