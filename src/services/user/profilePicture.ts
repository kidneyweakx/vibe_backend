import getPrisma from '../../dbConfig'
import { uploadToR2 } from '../file/uploadToR2'
import { updateUser } from './index'
import { getPresignedGetUrl } from '../r2/presign'
import type { R2UploadResult } from '../interfaces/file'
import { clearProfileBundleCache } from '../info/profileAggregator'

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
    const prisma = getPrisma()
    let actualUserId: string

    if (userId.startsWith('guest_')) {
      let guest = await prisma.user.findFirst({ where: { providerId: userId } })
      if (!guest) {
        guest = await prisma.user.create({
          data: {
            email: `${userId}@guest.local`,
            name: 'Guest User',
            provider: 'guest',
            providerId: userId,
            isGuest: true
          }
        })
      }
      actualUserId = guest.id
    } else {
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) throw new Error(`User with ID ${userId} not found`)
      actualUserId = user.id
    }

    // Upload to R2 with profile picture specific options
    const uploadOptions = {
      key: `profile-pictures/${actualUserId}/${Date.now()}-${imageFile.name}`,
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

    // Remove old profile picture if exists
    await getPrisma().photo.updateMany({
      where: { userId: actualUserId, isProfilePicture: true },
      data: { isProfilePicture: false }
    })

    // Create photo record in database
    const photo = await getPrisma().photo.create({
      data: {
        userId: actualUserId,
        key: uploadResult.key,
        url: uploadResult.url,
        format: imageFile.type.split('/')[1] || 'png',
        size: imageFile.size,
        isProfilePicture: true
      }
    })

    // Generate presigned URL
    const signedUrl = await getPresignedGetUrl(photo.key, 60 * 60 * 24 * 7)

    // Update user profile with new avatar key (not URL)
    try {
      await updateUser(actualUserId, { avatar: uploadResult.key })
    } catch (error: any) {
      return { success: false, error: 'Failed to update user profile' }
    }

    // Invalidate cached profile info so new avatar doesn't appear in photo lists
    try { clearProfileBundleCache() } catch {}

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
