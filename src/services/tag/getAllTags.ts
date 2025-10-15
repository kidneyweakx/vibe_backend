import type { PrismaClient } from '@prisma/client'

const isMissingCategoryColumn = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const message = (error as any)?.message
  return typeof message === 'string' && message.includes('no such column: category')
}

export async function getAllTags(prisma: PrismaClient) {
  try {
    return await prisma.tag.findMany({
      orderBy: [
        { category: 'asc' },
        { displayName: 'asc' }
      ]
    })
  } catch (error) {
    if (isMissingCategoryColumn(error)) {
      return prisma.tag.findMany({
        orderBy: { displayName: 'asc' }
      })
    }
    throw error
  }
}


