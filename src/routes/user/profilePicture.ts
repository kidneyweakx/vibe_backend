import { Elysia, t } from 'elysia'
import { uploadProfilePicture } from './service'

export const profilePictureRoute = new Elysia()
  .post('/profilePicture', async ({ body, set }) => {
    try {
      const { userId, imageFile } = body as { userId: string; imageFile: File }
      
      if (!userId || !imageFile) {
        set.status = 400
        return { success: false, error: 'userId and imageFile are required' }
      }

      // Validate file type
      if (!imageFile.type.startsWith('image/')) {
        set.status = 400
        return { success: false, error: 'File must be an image' }
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (imageFile.size > maxSize) {
        set.status = 413
        return { success: false, error: 'File size must be less than 5MB' }
      }

      const result = await uploadProfilePicture(userId, imageFile)
      return result
    } catch (error: any) {
      set.status = 400
      return { success: false, error: error.message }
    }
  }, {
    body: t.Object({
      userId: t.String(),
      imageFile: t.File()
    })
  })
