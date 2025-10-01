import { Elysia, t } from 'elysia'
import getPrisma from '../../dbConfig'
import { createTag } from '../../services/tag'

export const createTagRoute = new Elysia()
  .post('/', async ({ body, set }) => {
    try {
      const tag = await createTag(getPrisma(), body as any)
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


