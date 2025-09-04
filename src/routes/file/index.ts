import { Elysia } from 'elysia'
import { uploadRoute } from './upload'
import { verifyRoute } from './verify'
import { deleteFileRoute } from './delete'
import { testConfigRoute } from './testConfig'
import { photosUploadRoute } from './photosUpload'
import { presignCreateRoute } from './presignCreate'
import { photosCompleteRoute } from './photosComplete'
import { photosPresignRoute } from './photosPresign'
import { photosGetByUserRoute } from './photosGetByUser'
import { photosDeleteRoute } from './photosDelete'
import { reportRoute } from './report'

export const fileModule = new Elysia({ prefix: '/file' })
  .use(uploadRoute)
  .use(verifyRoute)
  .use(deleteFileRoute)
  .use(testConfigRoute)
  .get('/test', () => ({ success: true, message: 'File API is working' }))
  .use(photosUploadRoute)
  .use(presignCreateRoute)
  .use(photosCompleteRoute)
  .use(photosPresignRoute)
  .use(photosGetByUserRoute)
  .use(photosDeleteRoute)
  .use(reportRoute)