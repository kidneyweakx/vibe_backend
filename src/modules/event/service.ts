import getPrisma from '../../dbConfig'
import { getR2Client } from '../file/r2Client'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getPublicObjectUrl } from '../file/presign'

type UploadEventParams = {
  title: string
  description?: string
  imageBase64: string // base64 without data URL prefix
  startsAt: Date
  endsAt?: Date
}

export async function uploadEventImage(params: UploadEventParams) {
  const prisma = getPrisma()
  const { client, bucketName } = getR2Client()

  // Assume input is already webp base64 (keep API simple for Workers)
  const binaryString = atob(params.imageBase64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)

  const key = `events/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`

  await client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: bytes,
    ContentType: 'image/webp',
    ContentLength: bytes.length,
  }))

  const url = getPublicObjectUrl(key)

  const event = await prisma.event.create({
    data: {
      title: params.title,
      description: params.description,
      key,
      url,
      format: 'webp',
      size: bytes.length,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
    }
  })

  return event
}

export async function listEvents(limit: number = 20) {
  const prisma = getPrisma()
  const events = await prisma.event.findMany({
    orderBy: { startsAt: 'desc' },
    take: limit
  })
  return events
}


