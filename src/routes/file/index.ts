import { Elysia } from 'elysia'
import { requireAuth } from '../../middlewares/auth'
import { photosUploadRoute } from './photosUpload'
import { presignCreateRoute } from './presignCreate'
import { photosCompleteRoute } from './photosComplete'
import { photosGetByUserRoute } from './photosGetByUser'
import { photosDeleteRoute } from './photosDelete'
import { reportRoute } from './report'

export const fileModule = new Elysia({ prefix: '/file' })
  .use(requireAuth)
  .use(presignCreateRoute) // POST /presign/create
  .use(photosUploadRoute) // POST /photos/upload
  .use(photosCompleteRoute) // POST /photos/complete
  .use(photosGetByUserRoute) // GET /photos/user/:userId
  .use(photosDeleteRoute) // DELETE /photos/:photoId
  .use(reportRoute) // POST /report