import { Elysia, t } from 'elysia'
import { uploadToR2, verifyFile, deleteFile, testR2Config, uploadPhoto, getUserPhotos, deletePhoto, confirmPhotoUpload, generatePhotoKey, getExtensionFromContentType } from './service'
import { getPresignedPutUrl } from './presign'

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
  
  // Presigned direct upload flow
  .post('/presign', async ({ body, set }) => {
    try {
      const { userId, contentType, key } = body as { userId: string; contentType?: string; key?: string }
      if (!userId) {
        set.status = 422
        return { success: false, error: 'userId is required' }
      }
      const ext = getExtensionFromContentType(contentType)
      const finalKey = key && key.length > 0 ? key : generatePhotoKey(userId, ext)
      const url = await getPresignedPutUrl(finalKey, contentType || `image/${ext}`, 60 * 10)
      return { success: true, data: { url, key: finalKey, headers: { 'Content-Type': contentType || `image/${ext}` } } }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      userId: t.String(),
      contentType: t.Optional(t.String()),
      key: t.Optional(t.String())
    })
  })

  .post('/photos/complete', async ({ body, set }) => {
    try {
      const { userId, key, contentType, sizeBytes } = body as { userId: string; key: string; contentType?: string; sizeBytes?: number }
      if (!userId || !key) {
        set.status = 422
        return { success: false, error: 'userId and key are required' }
      }
      const format = getExtensionFromContentType(contentType) || (key.split('.').pop() || 'png')
      const result = await confirmPhotoUpload({ userId, key, format, size: sizeBytes })
      return { success: true, data: result }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      userId: t.String(),
      key: t.String(),
      contentType: t.Optional(t.String()),
      sizeBytes: t.Optional(t.Number())
    })
  })
  .post('/photos/presign', async ({ body, set }) => {
    try {
      const { userId, format, contentType } = body as { userId: string; format?: string; contentType?: string }
      if (!userId) {
        set.status = 400
        return { success: false, error: 'userId is required' }
      }
      const key = generatePhotoKey(userId, format || 'png')
      const url = await getPresignedPutUrl(key, contentType || `image/${format || 'png'}`, 60 * 10)
      return { success: true, data: { key, url } }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      userId: t.String(),
      format: t.Optional(t.String()),
      contentType: t.Optional(t.String())
    })
  })

  .post('/photos/confirm', async ({ body, set }) => {
    try {
      const { userId, key, format, size } = body as { userId: string; key: string; format?: string; size?: number }
      if (!userId || !key) {
        set.status = 400
        return { success: false, error: 'userId and key are required' }
      }
      const result = await confirmPhotoUpload({ userId, key, format, size })
      return { success: true, data: result }
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      userId: t.String(),
      key: t.String(),
      format: t.Optional(t.String()),
      size: t.Optional(t.Number())
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