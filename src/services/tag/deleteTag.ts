import type { PrismaClient } from '@prisma/client'

export async function deleteTag(prisma: PrismaClient, id: string) {
  await prisma.photoTag.deleteMany({ where: { tagId: id } })
  return prisma.tag.delete({ where: { id } })
}


