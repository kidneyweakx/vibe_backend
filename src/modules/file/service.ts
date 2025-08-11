import { R2UploadResult, UploadOptions, PhotoUploadResponse, PhotoListResponse, PhotoInfo } from './model'
import { PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { handleR2Error, logError } from './errors'
import getPrisma from '../../dbConfig'
import { getR2Client } from './r2Client'
import { getPublicObjectUrl, getPresignedGetUrl } from './presign'

// getR2Client moved to separate file for reuse

const validateFile = (file: File, options: UploadOptions = {}): string | null => {
  const allowedTypes = options.allowedTypes || ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const maxSize = options.maxSize || 10 * 1024 * 1024 // 10MB
  
  if (!allowedTypes.includes(file.type)) {
    return 'Invalid file type. Only images are allowed'
  }
  
  if (file.size > maxSize) {
    return 'File size exceeds limit'
  }
  
  return null
}

export const uploadToR2 = async (file: File, options: UploadOptions = {}): Promise<R2UploadResult> => {
  try {
    const validationError = validateFile(file, options)
    if (validationError) {
      return { success: false, error: validationError }
    }

    const { client, bucketName, accountId } = getR2Client()
    const fileKey = options.key || `uploads/${Date.now()}-${file.name}`
    
    const arrayBuffer = await file.arrayBuffer()
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      Body: new Uint8Array(arrayBuffer),
      ContentType: file.type,
      ContentLength: file.size
    })
    
    await client.send(command)

    const publicUrl = getPublicObjectUrl(fileKey)
    const signedUrl = await getPresignedGetUrl(fileKey, 60 * 60 * 24 * 7) // 7 days
    
    return {
      success: true,
      url: publicUrl,
      key: fileKey,
      // @ts-ignore extend shape for runtime
      signedUrl
    }
    
  } catch (error: any) {
    logError('Upload', null, error)
    return { success: false, error: handleR2Error(error) }
  }
}

export const verifyFile = async (key: string): Promise<boolean> => {
  try {
    const { client, bucketName } = getR2Client()
    const command = new HeadObjectCommand({ Bucket: bucketName, Key: key })
    await client.send(command)
    return true
  } catch {
    return false
  }
}

export const deleteFile = async (key: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { client, bucketName } = getR2Client()
    const command = new DeleteObjectCommand({ Bucket: bucketName, Key: key })
    await client.send(command)
    return { success: true }
  } catch (error: any) {
    logError('Delete', key, error)
    return { success: false, error: handleR2Error(error) }
  }
}

export const testR2Config = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const { client, bucketName } = getR2Client()
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: 'test-key-that-probably-doesnt-exist'
    })
    
    try {
      await client.send(command)
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return { success: true }
      }
      throw error
    }
    
    return { success: true }
  } catch (error: any) {
    logError('Config test', null, error)
    return { success: false, error: handleR2Error(error) }
  }
}

// Photo-specific operations
export const uploadPhoto = async (imageData: string, userId: string, format: string = 'png'): Promise<PhotoUploadResponse> => {
  try {
    console.log('Upload photo request:', { userId, format, imageDataLength: imageData.length })
    
    // Check if user exists, allow guest users
    if (!userId.startsWith('guest_')) {
      const user = await getPrisma().user.findUnique({
        where: { id: userId }
      })
      
      if (!user) {
        throw new Error(`User with ID ${userId} not found`)
      }
    }
    
    // Convert base64 to Uint8Array using Web APIs (Workers-friendly)
    const binaryString = atob(imageData)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const file = new File([bytes], `photo.${format}`, { type: `image/${format}` })
    
    // Generate unique key for photo
    const photoKey = `photos/${userId}/${Date.now()}.${format}`
    
    // Upload to R2
    const uploadResult = await uploadToR2(file, { key: photoKey })
    
    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Upload failed')
    }
    
    // Save to database (create guest user if needed)
    if (userId.startsWith('guest_')) {
      // Ensure guest user exists in database
      await getPrisma().user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email: `${userId}@guest.local`,
          name: 'Guest User',
          provider: 'guest',
          providerId: userId
        }
      })
    }
    
    const photo = await getPrisma().photo.create({
      data: {
        userId,
        key: uploadResult.key!,
        url: uploadResult.url!,
        format,
        size: bytes.length
      }
    })
    
    const signedUrl = await getPresignedGetUrl(photo.key, 60 * 60 * 24 * 7)
    return {
      photoId: photo.id,
      urls: {
        original: signedUrl
      },
      uploadedAt: photo.uploadedAt
    }
  } catch (error: any) {
    console.error('Photo upload error:', error)
    logError('Photo upload', null, error)
    throw error
  }
}

export const generatePhotoKey = (userId: string, format: string = 'png'): string => {
  return `photos/${userId}/${Date.now()}.${format}`
}

export const getExtensionFromContentType = (contentType?: string): string => {
  switch ((contentType || '').toLowerCase()) {
    case 'image/webp':
      return 'webp'
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/gif':
      return 'gif'
    default:
      return 'png'
  }
}

export const confirmPhotoUpload = async (
  params: { userId: string; key: string; format?: string; size?: number }
): Promise<PhotoUploadResponse> => {
  const { userId, key, format = (key.split('.').pop() || 'png'), size } = params
  try {
    // Verify object exists (best-effort)
    try {
      const { client, bucketName } = getR2Client()
      const head = new HeadObjectCommand({ Bucket: bucketName, Key: key })
      await client.send(head)
    } catch (e) {
      // Continue even if HEAD fails; client may have eventual consistency
    }

    // Ensure user exists or create guest
    if (userId.startsWith('guest_')) {
      await getPrisma().user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email: `${userId}@guest.local`,
          name: 'Guest User',
          provider: 'guest',
          providerId: userId
        }
      })
    } else {
      const user = await getPrisma().user.findUnique({ where: { id: userId } })
      if (!user) {
        throw new Error(`User with ID ${userId} not found`)
      }
    }

    const publicUrl = getPublicObjectUrl(key)

    const photo = await getPrisma().photo.create({
      data: {
        userId,
        key,
        url: publicUrl,
        format,
        size: size || 0
      }
    })

    const signedUrl = await getPresignedGetUrl(photo.key, 60 * 60 * 24 * 7)
    return {
      photoId: photo.id,
      urls: {
        original: signedUrl
      },
      uploadedAt: photo.uploadedAt
    }
  } catch (error: any) {
    console.error('Confirm photo upload error:', error)
    logError('Confirm photo upload', key, error)
    throw error
  }
}

export const getUserPhotos = async (userId: string, page: number = 1, limit: number = 20): Promise<PhotoListResponse> => {
  try {
    const skip = (page - 1) * limit
    
    const [photos, totalCount] = await Promise.all([
      getPrisma().photo.findMany({
        where: { userId },
        include: {
          photoTags: {
            include: {
              tag: true
            }
          }
        },
        orderBy: { uploadedAt: 'desc' },
        skip,
        take: limit
      }),
      getPrisma().photo.count({ where: { userId } })
    ])
    
    const photoInfos: PhotoInfo[] = await Promise.all(photos.map(async (photo) => ({
      id: photo.id,
      userId: photo.userId,
      urls: {
        original: await getPresignedGetUrl(photo.key, 60 * 60 * 24 * 7)
      },
      uploadedAt: photo.uploadedAt,
      tags: photo.photoTags.map((pt) => ({
        id: pt.tag.id,
        name: pt.tag.name,
        displayName: pt.tag.displayName,
        emoji: pt.tag.emoji ?? undefined,
        color: pt.tag.color ?? undefined,
        category: pt.tag.category ?? undefined
      }))
    })))
    
    return {
      photos: photoInfos,
      totalCount,
      hasMore: skip + photos.length < totalCount
    }
  } catch (error: any) {
    logError('Get user photos', userId, error)
    throw error
  }
}

export const deletePhoto = async (photoId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Get photo from database
    const photo = await getPrisma().photo.findUnique({
      where: { id: photoId }
    })
    
    if (!photo) {
      return { success: false, error: 'Photo not found' }
    }
    
    // Delete from R2
    const deleteResult = await deleteFile(photo.key)
    
    if (!deleteResult.success) {
      return deleteResult
    }
    
    // Delete from database
    await getPrisma().photo.delete({
      where: { id: photoId }
    })
    
    return { success: true }
  } catch (error: any) {
    logError('Delete photo', photoId, error)
    return { success: false, error: handleR2Error(error) }
  }
}