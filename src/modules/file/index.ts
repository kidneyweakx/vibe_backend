import { Elysia, t } from 'elysia'
import { uploadToR2, verifyFile, deleteFile, testR2Config } from './service'

export const fileModule = new Elysia({ prefix: '/file' })
  .post('/upload', async ({ body, set }) => {
    const { file, key } = body as { file: File; key?: string }
    
    if (!file) {
      set.status = 400
      return { success: false, error: 'File is required' }
    }
    
    const result = await uploadToR2(file, { key })
    
    if (!result.success) {
      set.status = 400
      return result
    }
    
    return {
      success: true,
      data: { url: result.url, key: result.key }
    }
  }, {
    body: t.Object({
      file: t.File({
        type: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        maxSize: '1m'
      }),
      key: t.Optional(t.String())
    })
  })
  
  .get('/verify/:key', async ({ params }) => {
    const exists = await verifyFile(params.key)
    return { success: true, exists }
  })
  
  .delete('/:key', async ({ params, set }) => {
    const result = await deleteFile(params.key)
    
    if (!result.success) {
      set.status = 404
      return { success: false, error: result.error }
    }
    
    return { success: true }
  })
  
  .get('/test-config', async ({ set }) => {
    const result = await testR2Config()
    
    if (!result.success) {
      set.status = 500
    }
    
    return result
  })