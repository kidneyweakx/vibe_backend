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
    include: { user: { select: { id: true, name: true, gender: true } } },
    orderBy: { uploadedAt: 'desc' },
    distinct: ['userId'],
    take: limit * 3
  })
  const shuffled = latestPerUser.sort(() => 0.5 - Math.random())
  const selected = shuffled.slice(0, limit)
  const withSignedUrl = await Promise.all(selected.map(async (photo) => ({
    ...photo,
    url: await getPresignedGetUrl(photo.key, 60 * 60 * 24 * 7)
  })))
  return withSignedUrl
}


