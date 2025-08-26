import type { PrismaClient } from '@prisma/client'

export async function addTagsToPhoto(prisma: PrismaClient, photoId: string, tagIds: string[]) {
  await prisma.photoTag.deleteMany({ where: { photoId } })
  const photoTags = tagIds.map((tagId) => ({ photoId, tagId }))
  return prisma.photoTag.createMany({ data: photoTags, skipDuplicates: true })
}


