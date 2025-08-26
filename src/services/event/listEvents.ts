import getPrisma from '../../dbConfig'
import { getPresignedGetUrl } from '../r2/presign'

export async function listEvents(limit: number = 20) {
  const prisma = getPrisma()
  const events = await prisma.event.findMany({ orderBy: { startsAt: 'desc' }, take: limit })
  const withSignedUrls = await Promise.all(events.map(async (e) => {
    try {
      if (e.format === 'external' || e.key.startsWith('external:')) {
        return { ...e, imageUrl: e.url }
      }
      const signed = await getPresignedGetUrl(e.key, 60 * 60)
      return { ...e, imageUrl: signed }
    } catch (error) {
      console.error('Failed to generate presigned URL for event:', e.id, error)
      return { ...e, imageUrl: e.url }
    }
  }))
  return withSignedUrls
}


