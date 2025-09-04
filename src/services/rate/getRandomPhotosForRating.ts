import getPrisma from '../../dbConfig'
import { getPresignedGetUrl } from '../../routes/file/presign'

export async function getRandomPhotosForRating(userId: string, limit: number = 10) {
  const latestPerUser = await getPrisma().photo.findMany({
    where: {
      AND: [
        { userId: { not: userId } },
        { userId: { not: { startsWith: 'guest' } } },
        { key: { not: { startsWith: 'profile-pictures/' } } },
        { ratings: { none: { raterId: userId } } }
      ]
    },
    include: { 
      user: { select: { id: true, name: true, gender: true } }
    },
    orderBy: { uploadedAt: 'desc' },
    distinct: ['userId'],
    take: limit * 8
  })
  // filter out photos with >= 2 reports using raw query (avoids type coupling)
  const reported = await getPrisma().$queryRaw<Array<{ photoId: string; reportCount: number | bigint }>>`
    SELECT photoId, COUNT(*) as reportCount
    FROM reports
    GROUP BY photoId
    HAVING COUNT(*) >= 2
  `
  const excluded = new Set(reported.map((r) => r.photoId))
  const candidates = latestPerUser.filter((p) => !excluded.has(p.id))
  const shuffled = candidates.sort(() => 0.5 - Math.random())
  const selected = shuffled.slice(0, limit)
  const withSignedUrl = await Promise.all(selected.map(async (photo) => ({
    ...photo,
    url: await getPresignedGetUrl(photo.key, 60 * 60 * 24 * 7)
  })))
  return withSignedUrl
}


