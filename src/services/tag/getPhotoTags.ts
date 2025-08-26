import type { PrismaClient } from '@prisma/client'

export async function getPhotoTags(prisma: PrismaClient, photoId: string) {
  return prisma.photoTag.findMany({
    where: { photoId },
    include: { tag: true }
  })
}


