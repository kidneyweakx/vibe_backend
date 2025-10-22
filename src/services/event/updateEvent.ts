import getPrisma from '../../dbConfig'
import { getR2Client } from '../r2/r2Client'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { deleteFile } from '../file/deleteFile'
import type { UpdateEventParams } from '../interfaces/event'
export async function updateEvent(params: UpdateEventParams) {
  const prisma = getPrisma()
  const existing = await prisma.event.findUnique({ where: { id: params.eventId } })
  if (!existing) throw new Error('Event not found')

  const data: any = {}

  if (typeof params.title !== 'undefined') data.title = params.title
  if (typeof params.description !== 'undefined') data.description = params.description
  if (typeof params.startsAt !== 'undefined') data.startsAt = params.startsAt
  if (typeof params.endsAt !== 'undefined') data.endsAt = params.endsAt
  
  // eventUrl or externalUrl
  if (typeof (params as any).eventUrl !== 'undefined') {
    data.url = (params as any).eventUrl || null
  }

  if (params.newImageBase64) {
    const isExternal = existing.format === 'external' || existing.key.startsWith('external:')
    if (!isExternal) {
      await deleteFile(existing.key)
    }
    const { client, bucketName } = getR2Client()
    const binaryString = atob(params.newImageBase64)
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
    data.key = key
    data.imageUrl = undefined
    data.format = 'webp'
    data.size = bytes.length
  } else if (typeof params.externalUrl !== 'undefined') {
    if (params.externalUrl) {
      const isExternal = existing.format === 'external' || existing.key.startsWith('external:')
      if (!isExternal) {
        await deleteFile(existing.key)
      }
      data.key = `external:${params.externalUrl}`
      data.imageUrl = params.externalUrl
      data.format = 'external'
      data.size = 0
    } else {
      data.imageUrl = null
    }
  }

  const updated = await prisma.event.update({ where: { id: params.eventId }, data })
  return updated
}
