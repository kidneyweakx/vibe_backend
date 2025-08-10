import { Elysia, t } from 'elysia'
import { uploadToR2, verifyFile, deleteFile, testR2Config, uploadPhoto, getUserPhotos, deletePhoto } from './service'

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
  
  // Test endpoint
  .get('/test', () => {
    console.log('Test endpoint hit')
    return { success: true, message: 'File API is working' }
  })
  
  // Photo API endpoints
  .post('/photos/upload', async ({ body, set }) => {
    try {
      const { userId, imageData, format } = body as { userId: string; imageData: string; format?: string }
      
      console.log('Photo upload request received:', { userId, format, imageDataLength: imageData?.length })
      
      if (!userId || !imageData) {
        set.status = 400
        return { success: false, error: 'userId and imageData are required' }
      }
      
      const result = await uploadPhoto(imageData, userId, format)
      return { success: true, data: result }
    } catch (error: any) {
      console.error('Photo upload API error:', error)
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      userId: t.String(),
      imageData: t.String(),
      format: t.Optional(t.String())
    })
  })
  
  .get('/photos/user/:userId', async ({ params, query }) => {
    try {
      const { userId } = params
      const page = parseInt(query.page as string) || 1
      const limit = parseInt(query.limit as string) || 20
      
      const result = await getUserPhotos(userId, page, limit)
      return { success: true, data: result }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  
  .delete('/photos/:photoId', async ({ params, set }) => {
    try {
      const result = await deletePhoto(params.photoId)
      
      if (!result.success) {
        set.status = 404
        return { success: false, error: result.error }
      }
      
      return { success: true }
    } catch (error: any) {
      set.status = 500
      return { success: false, error: error.message }
    }
  })