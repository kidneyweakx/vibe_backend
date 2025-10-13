import { Elysia, t } from 'elysia'
import getPrisma from '../../dbConfig'
import { createTag, deleteTag, updateTag } from '../../services/tag'

const logger = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [AdminTags] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [AdminTags] ERROR: ${message}`, error)
  }
}

export const adminTagRoutes = new Elysia()
  // Create new tag
  .post('/tag', async ({ body, set }: any) => {
    try {
      logger.info('Creating new tag', body)

      const prisma = getPrisma()
      const tag = await createTag(prisma, body)

      logger.info('Tag created', { tagId: tag.id, name: tag.name })
      return { success: true, data: tag }
    } catch (error) {
      logger.error('Failed to create tag', error)
      set.status = 400
      return { success: false, error: 'Failed to create tag' }
    }
  }, {
    body: t.Object({
      name: t.String(),
      displayName: t.String(),
      emoji: t.Optional(t.String()),
      color: t.Optional(t.String({ pattern: /^#(?:[0-9a-fA-F]{3}){1,2}$/ })),
      category: t.Optional(t.String()),
      normal: t.Optional(t.Boolean())
    })
  })
  
  // Update tag
  .put('/tag/:id', async ({ params, body, set }: any) => {
    try {
      const { id } = params
      
      logger.info('Updating tag', { id, ...body })

      const prisma = getPrisma()
      const tag = await updateTag(prisma, id, body)

      logger.info('Tag updated', { tagId: tag.id })
      return { success: true, data: tag }
    } catch (error) {
      logger.error('Failed to update tag', error)
      set.status = 400
      return { success: false, error: 'Failed to update tag' }
    }
  }, {
    body: t.Object({
      displayName: t.Optional(t.String()),
      emoji: t.Optional(t.String()),
      color: t.Optional(t.String({ pattern: /^#(?:[0-9a-fA-F]{3}){1,2}$/ })),
      category: t.Optional(t.String()),
      normal: t.Optional(t.Boolean())
    })
  })
  
  // Delete tag
  .delete('/tag/:id', async ({ params, set }: any) => {
    try {
      const { id } = params
      
      logger.info('Deleting tag', { id })

      const prisma = getPrisma()
      await deleteTag(prisma, id)

      logger.info('Tag deleted', { tagId: id })
      return { success: true, message: 'Tag deleted successfully' }
    } catch (error) {
      logger.error('Failed to delete tag', error)
      set.status = 400
      return { success: false, error: 'Failed to delete tag' }
    }
  })
  
  // List all tags with stats
  .get('/tags', async ({ set }: any) => {
    try {
      const prisma = getPrisma()
      
      const tags = await prisma.tag.findMany({
        include: {
          _count: {
            select: { photoTags: true }
          }
        },
        orderBy: { name: 'asc' }
      })
      
      const tagsWithStats = tags.map(tag => ({
        ...tag,
        usageCount: tag._count.photoTags,
        _count: undefined
      }))
      
      logger.info('Listed tags', { count: tags.length })
      return { success: true, data: tagsWithStats }
    } catch (error) {
      logger.error('Failed to list tags', error)
      set.status = 500
      return { success: false, error: 'Failed to list tags' }
    }
  })
