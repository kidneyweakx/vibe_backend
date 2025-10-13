import getPrisma from '../../dbConfig'
import { getPublicObjectUrl, getPresignedGetUrl } from '../../services/r2/presign'
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client } from '../r2/r2Client'

export async function confirmPhotoUpload(params: {
  userId: number | string
  key: string
  format?: string
  size?: number
  takenAt?: Date
}) {
  const { userId, key, format = (key.split('.').pop() || 'png'), size, takenAt } = params
  const prisma = getPrisma()
  try {
    try {
      const { client, bucketName } = getR2Client()
      const head = new HeadObjectCommand({ Bucket: bucketName, Key: key })
      await client.send(head)
    } catch (e) {}

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

    const publicUrl = getPublicObjectUrl(key)
    const photo = await prisma.photo.create({
      data: {
        userId: numericUserId,
        key,
        url: publicUrl,
        format,
        size: size || 0,
        takenAt: takenAt || undefined
      }
    })
    const signedUrl = await getPresignedGetUrl(photo.key, 60 * 60 * 24 * 7)
    return {
      id: photo.id,
      userId: photo.userId,
      key: photo.key,
      format: photo.format,
      photoId: photo.id,
      urls: { original: signedUrl },
      uploadedAt: photo.uploadedAt
    }
  } catch (error: any) {
    console.error('Confirm photo upload error:', error)
    throw error
  }
}


