import { Elysia } from 'elysia'
import { photosUploadRoute } from './photosUpload'
import { presignCreateRoute } from './presignCreate'
import { photosCompleteRoute } from './photosComplete'
import { photosGetByUserRoute } from './photosGetByUser'
import { photosDeleteRoute } from './photosDelete'
import { reportRoute } from './report'

export const fileModule = new Elysia({ prefix: '/file' })
  .use(presignCreateRoute)
  .use(photosUploadRoute)
  .use(photosCompleteRoute)
  .use(photosGetByUserRoute)
  .use(photosDeleteRoute)
  .use(reportRoute)