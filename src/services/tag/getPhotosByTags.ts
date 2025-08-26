import type { PrismaClient } from '@prisma/client'

export async function getPhotosByTags(
  prisma: PrismaClient,
  tagIds: string[],
  limit: number = 20,
  offset: number = 0
) {
  return prisma.photo.findMany({
    where: {
      photoTags: {
        some: {
          tagId: { in: tagIds }
        }
      }
    },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      photoTags: { include: { tag: true } },
      _count: { select: { ratings: true } }
    },
    orderBy: { uploadedAt: 'desc' },
    take: limit,
    skip: offset
  })
}


