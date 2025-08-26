import type { PrismaClient } from '@prisma/client'
import { getAllTags as svcGetAllTags } from '../../services/tag/getAllTags'
import { getTagsByCategory as svcGetTagsByCategory } from '../../services/tag/getTagsByCategory'
import { addTagsToPhoto as svcAddTagsToPhoto } from '../../services/tag/addTagsToPhoto'
import { getPhotoTags as svcGetPhotoTags } from '../../services/tag/getPhotoTags'
import { getPhotosByTags as svcGetPhotosByTags } from '../../services/tag/getPhotosByTags'
import { getPopularTags as svcGetPopularTags } from '../../services/tag/getPopularTags'
import { createTag as svcCreateTag } from '../../services/tag/createTag'
import { updateTag as svcUpdateTag } from '../../services/tag/updateTag'
import { deleteTag as svcDeleteTag } from '../../services/tag/deleteTag'

export class TagService {
  constructor(private prisma: PrismaClient) {}

  async getAllTags() { return svcGetAllTags(this.prisma) }
  async getTagsByCategory(category: string) { return svcGetTagsByCategory(this.prisma, category) }
  async addTagsToPhoto(photoId: string, tagIds: string[]) { return svcAddTagsToPhoto(this.prisma, photoId, tagIds) }
  async getPhotoTags(photoId: string) { return svcGetPhotoTags(this.prisma, photoId) }
  async getPhotosByTags(tagIds: string[], limit = 20, offset = 0) { return svcGetPhotosByTags(this.prisma, tagIds, limit, offset) }
  async getPopularTags(limit = 10) { return svcGetPopularTags(this.prisma, limit) }
  async createTag(data: { name: string; displayName: string; emoji?: string; color?: string; category?: string }) { return svcCreateTag(this.prisma, data) }
  async updateTag(id: string, data: { displayName?: string; emoji?: string; color?: string; category?: string }) { return svcUpdateTag(this.prisma, id, data) }
  async deleteTag(id: string) { return svcDeleteTag(this.prisma, id) }
}