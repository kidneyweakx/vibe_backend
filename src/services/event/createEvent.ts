import getPrisma from '../../dbConfig'
import { getR2Client } from '../r2/r2Client'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getPublicObjectUrl } from '../../services/r2/presign'
import type { CreateEventParams } from '../interfaces/event'

export async function createEvent(params: CreateEventParams) {
  const prisma = getPrisma()

  // Create via upload to R2
  if ('imageBase64' in params && params.imageBase64) {
    const { client, bucketName } = getR2Client()

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
        imageUrl: url,
        format: 'webp',
        size: bytes.length,
        startsAt: params.startsAt,
        endsAt: params.endsAt,
      }
    })

    return event
  }

  // Create via external URL
  if ('externalUrl' in params && params.externalUrl) {
    const url = params.externalUrl
    const event = await prisma.event.create({
      data: {
        title: params.title,
        description: params.description,
        key: `external:${url}`,
        url,
        imageUrl: url,
        format: 'external',
        size: 0,
        startsAt: params.startsAt,
        endsAt: params.endsAt,
      }
    })
    return event
  }

  throw new Error('Invalid createEvent params: must provide imageBase64 or externalUrl')
}


