import getPrisma from '../../dbConfig'
import { getPresignedGetUrl } from '../r2/presign'
import type { PhotoListResponse, PhotoInfo } from '../interfaces/file'

export async function getAllPhotos(params: { page?: number; limit?: number; userId?: number | string; tagId?: string }): Promise<PhotoListResponse> {
  const page = params.page && params.page > 0 ? params.page : 1
  const limit = params.limit && params.limit > 0 ? params.limit : 20
  const skip = (page - 1) * limit
  const where: any = {
    // Always exclude profile pictures from general photo queries
    key: { not: { startsWith: 'profile-pictures/' } }
  }
  if (params.userId !== undefined) {
    const numericUserId = typeof params.userId === 'number' ? params.userId : Number(params.userId)
    if (!Number.isFinite(numericUserId)) {
      throw new Error('Invalid user identifier')
    }
    where.userId = numericUserId
  }
  if (params.tagId) where.photoTags = { some: { tagId: params.tagId } }
  const [photos, totalCount] = await Promise.all([
    getPrisma().photo.findMany({
      where,
      include: { photoTags: { include: { tag: true } } },
      orderBy: { uploadedAt: 'desc' },
      skip,
      take: limit
    }),
    getPrisma().photo.count({ where })
  ])
  const photoInfos: PhotoInfo[] = await Promise.all(photos.map(async (photo) => ({
    id: photo.id,
    userId: photo.userId,
    urls: { original: await getPresignedGetUrl(photo.key, 60 * 60 * 24 * 7) },
    uploadedAt: photo.uploadedAt,
    tags: photo.photoTags.map((pt) => ({
      id: pt.tag.id,
      name: pt.tag.name,
      displayName: pt.tag.displayName,
      emoji: pt.tag.emoji ?? undefined,
      color: pt.tag.color ?? undefined,
      category: pt.tag.category ?? undefined
    }))
  })))
  return { photos: photoInfos, totalCount, hasMore: skip + photos.length < totalCount }
}


