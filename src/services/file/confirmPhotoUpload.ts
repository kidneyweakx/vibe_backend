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

    let resolvedUserId: string

    if (typeof userId === 'string') {
      const trimmed = userId.trim()
      if (!trimmed) {
        throw new Error('User ID is required')
      }

      if (trimmed.startsWith('guest_')) {
        let guest = await prisma.user.findFirst({ where: { providerId: trimmed } })
        if (!guest) {
          guest = await prisma.user.create({
            data: {
              email: `${trimmed}@guest.local`,
              name: 'Guest User',
              provider: 'guest',
              providerId: trimmed,
              isGuest: true
            }
          })
        }
        resolvedUserId = guest.id
      } else {
        const user = await prisma.user.findUnique({ where: { id: trimmed } })
        if (!user) {
          const fallbackGuest = await prisma.user.findFirst({ where: { providerId: trimmed } })
          if (!fallbackGuest) {
            throw new Error(`User with ID ${userId} not found`)
          }
          resolvedUserId = fallbackGuest.id
        } else {
          resolvedUserId = user.id
        }
      }
    } else {
      const candidate = String(userId)
      const user = await prisma.user.findUnique({ where: { id: candidate } })
      if (!user) {
        const fallbackGuest = await prisma.user.findFirst({ where: { providerId: candidate } })
        if (!fallbackGuest) {
          throw new Error(`User with ID ${userId} not found`)
        }
        resolvedUserId = fallbackGuest.id
      } else {
        resolvedUserId = user.id
      }
    }

    const publicUrl = getPublicObjectUrl(key)
    const photo = await prisma.photo.create({
      data: {
        userId: resolvedUserId,
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


