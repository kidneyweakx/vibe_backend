import type { PrismaClient } from '@prisma/client'

export async function addTagsToPhoto(prisma: PrismaClient, photoId: string, tagIds: string[]) {
  // Remove existing tags for this photo
  await prisma.photoTag.deleteMany({ where: { photoId } })

  // Add new tags (no duplicates possible after delete)
  const photoTags = tagIds.map((tagId) => ({ photoId, tagId }))
  if (photoTags.length > 0) {
    return prisma.photoTag.createMany({ data: photoTags })
  }
  return { count: 0 }
}


