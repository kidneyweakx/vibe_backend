import getPrisma from '../../dbConfig'
import { uploadToR2 } from './uploadToR2'
import { getPresignedGetUrl } from '../r2/presign'

export async function uploadPhoto(imageData: string, userId: number | string, format: string = 'png') {
  try {
    const prisma = getPrisma()
    let numericUserId: number

    if (typeof userId === 'string' && userId.startsWith('guest_')) {
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
      numericUserId = guest.id
    } else {
      numericUserId = typeof userId === 'number' ? userId : Number(userId)
      if (!Number.isFinite(numericUserId)) {
        throw new Error(`User with ID ${userId} not found`)
      }

      const user = await prisma.user.findUnique({ where: { id: numericUserId } })
      if (!user) throw new Error(`User with ID ${userId} not found`)
    }

    const binaryString = atob(imageData)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
    const file = new File([bytes], `photo.${format}`, { type: `image/${format}` })
    const photoKey = `photos/${numericUserId}/${Date.now()}.${format}`
    const uploadResult = await uploadToR2(file, { key: photoKey })
    if (!uploadResult.success) throw new Error(uploadResult.error || 'Upload failed')
    const photo = await prisma.photo.create({
      data: { userId: numericUserId, key: uploadResult.key!, url: uploadResult.url!, format, size: bytes.length }
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


