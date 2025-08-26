import type { PrismaClient } from '@prisma/client'

export async function getTagsByCategory(prisma: PrismaClient, category: string) {
  return prisma.tag.findMany({
    where: { category },
    orderBy: { displayName: 'asc' }
  })
}


