import type { PrismaClient } from '@prisma/client'

const isMissingCategoryColumn = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const message = (error as any)?.message
  return typeof message === 'string' && message.includes('no such column: category')
}

export async function getTagsByCategory(prisma: PrismaClient, category: string) {
  try {
    return await prisma.tag.findMany({
      where: { category },
      orderBy: { displayName: 'asc' }
    })
  } catch (error) {
    if (isMissingCategoryColumn(error)) {
      return []
    }
    throw error
  }
}


