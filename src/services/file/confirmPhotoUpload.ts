import getPrisma from '../../dbConfig'
import { getPublicObjectUrl, getPresignedGetUrl } from '../r2/presign'
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client } from '../r2/r2Client'

export async function confirmPhotoUpload(params: { userId: string; key: string; format?: string; size?: number }) {
  const { userId, key, format = (key.split('.').pop() || 'png'), size } = params
  try {
    try {
      const { client, bucketName } = getR2Client()
      const head = new HeadObjectCommand({ Bucket: bucketName, Key: key })
      await client.send(head)
    } catch (e) {}

    if (userId.startsWith('guest_')) {
      await getPrisma().user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, email: `${userId}@guest.local`, name: 'Guest User', provider: 'guest', providerId: userId }
      })
    } else {
      const user = await getPrisma().user.findUnique({ where: { id: userId } })
      if (!user) throw new Error(`User with ID ${userId} not found`)
    }

    const publicUrl = getPublicObjectUrl(key)
    const photo = await getPrisma().photo.create({
      data: { userId, key, url: publicUrl, format, size: size || 0 }
    })
    const signedUrl = await getPresignedGetUrl(photo.key, 60 * 60 * 24 * 7)
    return { photoId: photo.id, urls: { original: signedUrl }, uploadedAt: photo.uploadedAt }
  } catch (error: any) {
    console.error('Confirm photo upload error:', error)
    throw error
  }
}


