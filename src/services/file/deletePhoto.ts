import getPrisma from '../../dbConfig'
import { deleteFile as deleteR2File } from './deleteFile'
import { handleR2Error, logError } from './errors'

export async function deletePhoto(photoId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const photo = await getPrisma().photo.findUnique({ where: { id: photoId } })
    if (!photo || photo.userId !== userId) {
      return { success: false, error: 'Photo not found or unauthorized' }
    }
    const deleteResult = await deleteR2File(photo.key)
    if (!deleteResult.success) {
      return deleteResult
    }
    await getPrisma().photo.delete({ where: { id: photoId } })
    return { success: true }
  } catch (error: any) {
    logError('Delete photo', photoId, error)
    return { success: false, error: handleR2Error(error) }
  }
}


