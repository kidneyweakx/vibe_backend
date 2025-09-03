import getPrisma from '../../dbConfig'
import { uploadToR2 } from '../file/uploadToR2'
import { updateUser } from './index'
import { getPresignedGetUrl } from '../r2/presign'
import type { R2UploadResult } from '../interfaces/file'

export async function uploadProfilePicture(userId: string, imageFile: File): Promise<{
  success: boolean
  data?: {
    photoId: string
    urls: {
      original: string
    }
    uploadedAt: Date
    avatarUrl: string
  }
  error?: string
}> {
  try {
    // Validate user exists (except for guest users)
    if (!userId.startsWith('guest_')) {
      const user = await getPrisma().user.findUnique({ where: { id: userId } })
      if (!user) throw new Error(`User with ID ${userId} not found`)
    }

    // Upload to R2 with profile picture specific options
    const uploadOptions = {
      key: `profile-pictures/${userId}/${Date.now()}-${imageFile.name}`,
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maxSize: 5 * 1024 * 1024 // 5MB
    }

    const uploadResult: R2UploadResult = await uploadToR2(imageFile, uploadOptions)
    
    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error || 'Upload failed' }
    }

    if (!uploadResult.url || !uploadResult.key) {
      return { success: false, error: 'Upload succeeded but no URL or key returned' }
    }

    // Create guest user if needed
    if (userId.startsWith('guest_')) {
      await getPrisma().user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, email: `${userId}@guest.local`, name: 'Guest User', provider: 'guest', providerId: userId }
      })
    }

    // Create photo record in database
    const photo = await getPrisma().photo.create({
      data: { 
        userId, 
        key: uploadResult.key, 
        url: uploadResult.url, 
        format: imageFile.type.split('/')[1] || 'png', 
        size: imageFile.size 
      }
    })

    // Generate presigned URL
    const signedUrl = await getPresignedGetUrl(photo.key, 60 * 60 * 24 * 7)

    // Update user profile with new avatar key (not URL)
    try {
      await updateUser(userId, { avatar: uploadResult.key })
    } catch (error: any) {
      return { success: false, error: 'Failed to update user profile' }
    }

    return {
      success: true,
      data: {
        photoId: photo.id,
        urls: {
          original: signedUrl
        },
        uploadedAt: photo.uploadedAt,
        avatarUrl: signedUrl
      }
    }
  } catch (error: any) {
    console.error('Profile picture upload error:', error)
    return { success: false, error: error.message }
  }
}
