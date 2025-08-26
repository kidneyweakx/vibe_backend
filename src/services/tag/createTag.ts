import type { PrismaClient } from '@prisma/client'

export interface CreateTagParams {
  name: string
  displayName: string
  emoji?: string
  color?: string
  category?: string
}

export async function createTag(prisma: PrismaClient, data: CreateTagParams) {
  return prisma.tag.create({ data })
}


