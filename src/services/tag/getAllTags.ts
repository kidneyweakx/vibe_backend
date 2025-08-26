import type { PrismaClient } from '@prisma/client'

export async function getAllTags(prisma: PrismaClient) {
  return prisma.tag.findMany({
    orderBy: [
      { category: 'asc' },
      { displayName: 'asc' }
    ]
  })
}


