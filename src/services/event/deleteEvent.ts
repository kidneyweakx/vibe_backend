import getPrisma from '../../dbConfig'
import { deleteFile } from '../file/deleteFile'

export async function deleteEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
  const prisma = getPrisma()
  try {
    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event) {
      return { success: false, error: 'Event not found' }
    }
    const isExternal = event.format === 'external' || event.key.startsWith('external:')
    if (!isExternal) {
      const delRes = await deleteFile(event.key)
      if (!delRes.success) {
        return delRes
      }
    }
    await prisma.event.delete({ where: { id: eventId } })
    return { success: true }
  } catch (error: any) {
    console.error('Delete event error:', error)
    return { success: false, error: String(error?.message || error) }
  }
}


