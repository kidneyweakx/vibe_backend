import { uploadToR2 } from '../file/uploadToR2'
import { updateUser } from './index'
import type { R2UploadResult } from '../interfaces/file'

export async function uploadProfilePicture(userId: string, imageFile: File): Promise<{
  success: boolean
  data?: {
    avatarUrl: string
    thumbnailUrl: string
    uploadId: string
  }
  error?: string
}> {
  try {
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

    // Update user profile with new avatar URL
    if (!uploadResult.url) {
      return { success: false, error: 'Upload succeeded but no URL returned' }
    }

    try {
      await updateUser(userId, { avatar: uploadResult.url })
    } catch (error: any) {
      return { success: false, error: 'Failed to update user profile' }
    }

    return {
      success: true,
      data: {
        avatarUrl: uploadResult.url,
        thumbnailUrl: uploadResult.url, // For now, same as avatar URL
        uploadId: uploadResult.key || ''
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
