import { PrismaClient } from '@prisma/client'

export class TagService {
  constructor(private prisma: PrismaClient) {}

  // 獲取所有標籤
  async getAllTags() {
    return this.prisma.tag.findMany({
      orderBy: [
        { category: 'asc' },
        { displayName: 'asc' }
      ]
    })
  }

  // 根據分類獲取標籤
  async getTagsByCategory(category: string) {
    return this.prisma.tag.findMany({
      where: { category },
      orderBy: { displayName: 'asc' }
    })
  }

  // 為照片添加標籤
  async addTagsToPhoto(photoId: string, tagIds: string[]) {
    // 先刪除現有的標籤關聯
    await this.prisma.photoTag.deleteMany({
      where: { photoId }
    })

    // 添加新的標籤關聯
    const photoTags = tagIds.map(tagId => ({
      photoId,
      tagId
    }))

    return this.prisma.photoTag.createMany({
      data: photoTags,
      skipDuplicates: true
    })
  }

  // 獲取照片的標籤
  async getPhotoTags(photoId: string) {
    return this.prisma.photoTag.findMany({
      where: { photoId },
      include: {
        tag: true
      }
    })
  }

  // 根據標籤搜索照片
  async getPhotosByTags(tagIds: string[], limit = 20, offset = 0) {
    return this.prisma.photo.findMany({
      where: {
        photoTags: {
          some: {
            tagId: {
              in: tagIds
            }
          }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        },
        photoTags: {
          include: {
            tag: true
          }
        },
        _count: {
          select: {
            ratings: true
          }
        }
      },
      orderBy: {
        uploadedAt: 'desc'
      },
      take: limit,
      skip: offset
    })
  }

  // 獲取熱門標籤 (使用次數最多的標籤)
  async getPopularTags(limit = 10) {
    const result = await this.prisma.tag.findMany({
      include: {
        _count: {
          select: {
            photoTags: true
          }
        }
      },
      orderBy: {
        photoTags: {
          _count: 'desc'
        }
      },
      take: limit
    })

    return result.filter(tag => tag._count.photoTags > 0)
  }

  // 創建新標籤 (管理員功能)
  async createTag(data: {
    name: string
    displayName: string
    emoji?: string
    color?: string
    category?: string
  }) {
    return this.prisma.tag.create({
      data
    })
  }

  // 更新標籤
  async updateTag(id: string, data: {
    displayName?: string
    emoji?: string
    color?: string
    category?: string
  }) {
    return this.prisma.tag.update({
      where: { id },
      data
    })
  }

  // 刪除標籤
  async deleteTag(id: string) {
    // 先刪除所有相關的 PhotoTag 記錄
    await this.prisma.photoTag.deleteMany({
      where: { tagId: id }
    })

    // 然後刪除標籤本身
    return this.prisma.tag.delete({
      where: { id }
    })
  }
}