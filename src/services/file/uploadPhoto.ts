import getPrisma from '../../dbConfig'
import { uploadToR2 } from './uploadToR2'
import { getPresignedGetUrl } from '../r2/presign'

export async function uploadPhoto(imageData: string, userId: string, format: string = 'png') {
  try {
    if (!userId.startsWith('guest_')) {
      const user = await getPrisma().user.findUnique({ where: { id: userId } })
      if (!user) throw new Error(`User with ID ${userId} not found`)
    }
    const binaryString = atob(imageData)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
    const file = new File([bytes], `photo.${format}`, { type: `image/${format}` })
    const photoKey = `photos/${userId}/${Date.now()}.${format}`
    const uploadResult = await uploadToR2(file, { key: photoKey })
    if (!uploadResult.success) throw new Error(uploadResult.error || 'Upload failed')
    if (userId.startsWith('guest_')) {
      await getPrisma().user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, email: `${userId}@guest.local`, name: 'Guest User', provider: 'guest', providerId: userId }
      })
    }
    const photo = await getPrisma().photo.create({
      data: { userId, key: uploadResult.key!, url: uploadResult.url!, format, size: bytes.length }
    })
    const signedUrl = await getPresignedGetUrl(photo.key, 60 * 60 * 24 * 7)
    return {
      id: photo.id,
      userId: photo.userId,
      photoId: photo.id,
      urls: { original: signedUrl },
      uploadedAt: photo.uploadedAt
    }
  } catch (error: any) {
    console.error('Photo upload error:', error)
    throw error
  }
}


