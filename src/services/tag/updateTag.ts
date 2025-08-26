import type { PrismaClient } from '@prisma/client'

export interface UpdateTagParams {
  displayName?: string
  emoji?: string
  color?: string
  category?: string
}

export async function updateTag(prisma: PrismaClient, id: string, data: UpdateTagParams) {
  return prisma.tag.update({ where: { id }, data })
}


