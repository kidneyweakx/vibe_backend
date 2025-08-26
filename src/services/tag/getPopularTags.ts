import type { PrismaClient } from '@prisma/client'

export async function getPopularTags(prisma: PrismaClient, limit: number = 10) {
  const result = await prisma.tag.findMany({
    include: {
      _count: { select: { photoTags: true } }
    },
    orderBy: {
      photoTags: { _count: 'desc' }
    },
    take: limit
  })

  return result.filter((tag) => tag._count.photoTags > 0)
}


