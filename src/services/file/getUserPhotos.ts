import getPrisma from '../../dbConfig'
import { getPresignedGetUrl } from '../r2/presign'
import type { PhotoListResponse, PhotoInfo } from '../interfaces/file'

export async function getUserPhotos(userId: string, page: number = 1, limit: number = 20): Promise<PhotoListResponse> {
  try {
    const skip = (page - 1) * limit
    const [photos, totalCount] = await Promise.all([
      getPrisma().photo.findMany({
        where: { userId },
        include: { photoTags: { include: { tag: true } } },
        orderBy: { uploadedAt: 'desc' },
        skip,
        take: limit
      }),
      getPrisma().photo.count({ where: { userId } })
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
  } catch (error: any) {
    console.error('Get user photos error:', error)
    throw error
  }
}


