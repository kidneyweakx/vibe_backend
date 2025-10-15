import { Elysia, t } from 'elysia'
import getPrisma from '../../dbConfig'
import { confirmPhotoUpload, getUserPhotos, deletePhoto, generatePhotoKey } from '../../services/file'
import { getPresignedPutUrl, getPresignedGetUrl } from '../../services/r2/presign'
import { uploadToR2 } from '../../services/file/uploadToR2'

const logger = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [Photos] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [Photos] ERROR: ${message}`, error)
  }
}

export const photoRoutes = new Elysia()
  // Get presigned URL for upload
  .post('/upload-url', async ({ body, user, set }: any) => {
    try {
      const { contentType = 'image/jpeg', isProfilePicture = false, key: requestedKey } = body

      logger.info('Generating upload URL', {
        userId: user.id,
        contentType,
        isProfilePicture
      })

      const extension = contentType.split('/')[1] || 'jpg'
      const key = requestedKey && !isProfilePicture
        ? requestedKey
        : isProfilePicture
          ? `profile-pictures/${user.id}-${Date.now()}.${extension}`
          : generatePhotoKey(user.id, extension)

      const uploadUrl = await getPresignedPutUrl(key, contentType)

      return {
        success: true,
        key,
        uploadUrl,
        expiresIn: 3600,
        headers: {
          'Content-Type': contentType
        }
      }

    } catch (error) {
      logger.error('Failed to generate upload URL', error)
      set.status = 500
      return { success: false, error: 'Failed to generate upload URL' }
    }
  }, {
    body: t.Object({
      contentType: t.Optional(t.String()),
      isProfilePicture: t.Optional(t.Boolean()),
      key: t.Optional(t.String())
    })
  })

  // Direct upload with base64 data
  .post('/upload', async ({ body, user, set }: any) => {
    try {
      const { imageData, contentType = 'image/jpeg', isProfilePicture = false, key: requestedKey } = body

      if (!imageData) {
        set.status = 400
        return { success: false, error: 'Image data required' }
      }

      logger.info('Direct upload started', {
        userId: user.id,
        contentType,
        isProfilePicture,
        dataSize: imageData.length
      })

      const extension = contentType.split('/')[1] || 'jpg'
      const key = requestedKey && !isProfilePicture
        ? requestedKey
        : isProfilePicture
          ? `profile-pictures/${user.id}-${Date.now()}.${extension}`
          : generatePhotoKey(user.id, extension)

      // Decode base64 and upload
      const buffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      await uploadToR2(key, buffer, contentType)

      // Confirm in database
      const photo = await confirmPhotoUpload({
        userId: user.id,
        key,
        format: extension,
        size: buffer.length,
        isProfilePicture
      })

      const url = await getPresignedGetUrl(key, 60 * 60 * 24 * 7)

      logger.info('Direct upload completed', {
        userId: user.id,
        photoId: photo.id,
        key
      })

      return {
        success: true,
        photo: { ...photo, url }
      }
    } catch (error) {
      logger.error('Direct upload failed', error)
      set.status = 500
      return { success: false, error: 'Upload failed' }
    }
  }, {
    body: t.Object({
      imageData: t.String(),
      contentType: t.Optional(t.String()),
      isProfilePicture: t.Optional(t.Boolean()),
      key: t.Optional(t.String())
    })
  })

  // Confirm upload completed (for presigned URL uploads)
  .post('/confirm', async ({ body, user, set }: any) => {
    try {
      const { key, size, sizeBytes, isProfilePicture = false } = body

      if (!key) {
        set.status = 400
        return { success: false, error: 'Key required' }
      }

      logger.info('Confirming upload', {
        userId: user.id,
        key,
        isProfilePicture
      })

      const format = key.split('.').pop() || 'jpg'
      const photo = await confirmPhotoUpload({
        userId: user.id,
        key,
        format,
        size: sizeBytes || size || 0,
        isProfilePicture
      })

      const url = await getPresignedGetUrl(key, 60 * 60 * 24 * 7)

      return {
        success: true,
        photo: { ...photo, url }
      }
    } catch (error) {
      logger.error('Failed to confirm upload', error)
      set.status = 500
      return { success: false, error: 'Failed to confirm upload' }
    }
  }, {
    body: t.Object({
      key: t.String(),
      size: t.Optional(t.Number()),
      sizeBytes: t.Optional(t.Number()),
      contentType: t.Optional(t.String()),
      isProfilePicture: t.Optional(t.Boolean())
    })
  })

  // Get user's photos
  .get('/user/:userId', async ({ params, query, set }: any) => {
    try {
      const { userId } = params
      const page = parseInt(query.page as string) || 1
      const limit = Math.min(parseInt(query.limit as string) || 20, 100)

      logger.info('Fetching user photos', {
        userId,
        page,
        limit
      })

      const { photos, totalCount, hasMore } = await getUserPhotos(userId, page, limit)

      return {
        success: true,
        data: photos,
        page,
        limit,
        totalCount,
        hasMore
      }
    } catch (error) {
      logger.error('Failed to get user photos', error)
      set.status = 500
      return { success: false, error: 'Failed to get photos' }
    }
  })

  // Delete photo
  .delete('/:photoId', async ({ params, user, set }: any) => {
    try {
      const { photoId } = params

      logger.info('Deleting photo', {
        userId: user.id,
        photoId
      })

      const result = await deletePhoto(photoId, user.id)

      if (!result.success) {
        set.status = result.error === 'Photo not found or unauthorized' ? 404 : 400
        return { success: false, error: result.error || 'Failed to delete photo' }
      }

      return { success: true, message: 'Photo deleted' }
    } catch (error) {
      logger.error('Failed to delete photo', error)
      set.status = 500
      return { success: false, error: 'Failed to delete photo' }
    }
  })
