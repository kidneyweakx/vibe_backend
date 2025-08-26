import { Elysia, t } from 'elysia'
import { TagService } from './service'
import { getPresignedGetUrl } from '../../modules/file/presign'
import { requireAuth } from '../../middlewares/auth'
import getPrisma from '../../dbConfig'

export const tagModule = new Elysia({ prefix: '/tags' })
  // Lazily create TagService per request to avoid env access at module load
  .derive(() => ({ tagService: new TagService(getPrisma()) }))
  
  // 獲取所有標籤
  .get('/', async ({ tagService, query, set }) => {
    try {
      const tags = query.category 
        ? await tagService.getTagsByCategory(query.category)
        : await tagService.getAllTags()
      
      return {
        success: true,
        data: tags
      }
    } catch (error) {
      console.error('獲取標籤失敗:', error)
      set.status = 500
      return {
        success: false,
        error: '獲取標籤失敗'
      }
    }
  }, {
    query: t.Object({
      category: t.Optional(t.String())
    })
  })

  // 獲取熱門標籤
  .get('/popular', async ({ tagService, query, set }) => {
    try {
      const tags = await tagService.getPopularTags(query.limit || 10)
      
      return {
        success: true,
        data: tags
      }
    } catch (error) {
      console.error('獲取熱門標籤失敗:', error)
      set.status = 500
      return {
        success: false,
        error: '獲取熱門標籤失敗'
      }
    }
  }, {
    query: t.Object({
      limit: t.Optional(t.Number())
    })
  })

  // 為照片添加標籤 (需要認證)
  .use(requireAuth)
  .post('/photos/:photoId', async ({ tagService, params, body, user, set }) => {
    try {
      // 驗證照片是否屬於當前用戶
      const photo = await getPrisma().photo.findFirst({
        where: {
          id: params.photoId,
          userId: user.id
        }
      })
      
      if (!photo) {
        set.status = 404
        return {
          success: false,
          error: '照片不存在或無權限'
        }
      }
      
      await tagService.addTagsToPhoto(params.photoId, body.tagIds)
      
      return {
        success: true,
        message: '標籤添加成功'
      }
    } catch (error) {
      console.error('添加標籤失敗:', error)
      set.status = 500
      return {
        success: false,
        error: '添加標籤失敗'
      }
    }
  }, {
    params: t.Object({
      photoId: t.String()
    }),
    body: t.Object({
      tagIds: t.Array(t.String(), { minItems: 1 })
    })
  })

  // 獲取照片的標籤
  .get('/photos/:photoId', async ({ tagService, params, set }) => {
    try {
      const photoTags = await tagService.getPhotoTags(params.photoId)
      
      return {
        success: true,
        data: photoTags.map(pt => pt.tag)
      }
    } catch (error) {
      console.error('獲取照片標籤失敗:', error)
      set.status = 500
      return {
        success: false,
        error: '獲取照片標籤失敗'
      }
    }
  }, {
    params: t.Object({
      photoId: t.String()
    })
  })

  // 根據標籤搜索照片
  .get('/search', async ({ tagService, query, set }) => {
    if (!query.tagIds || query.tagIds.length === 0) {
      set.status = 400
      return {
        success: false,
        error: '請選擇至少一個標籤'
      }
    }
    
    try {
      const photos = await tagService.getPhotosByTags(
        query.tagIds, 
        query.limit || 20, 
        query.offset || 0
      )
      
      // 將 url 轉為 presigned URL
      const transformed = await Promise.all(
        photos.map(async (p: any) => ({
          ...p,
          url: await getPresignedGetUrl(p.key, 60 * 60 * 24 * 7)
        }))
      )
      
      return {
        success: true,
        data: transformed
      }
    } catch (error) {
      console.error('搜索照片失敗:', error)
      set.status = 500
      return {
        success: false,
        error: '搜索照片失敗'
      }
    }
  }, {
    query: t.Object({
      tagIds: t.Array(t.String()),
      limit: t.Optional(t.Number()),
      offset: t.Optional(t.Number())
    })
  })

  // 創建新標籤 (管理員功能，暫時開放給所有認證用戶)
  .post('/', async ({ tagService, body, set }) => {
    try {
      const tag = await tagService.createTag(body)
      
      return {
        success: true,
        data: tag
      }
    } catch (error) {
      console.error('創建標籤失敗:', error)
      set.status = 500
      return {
        success: false,
        error: '創建標籤失敗'
      }
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