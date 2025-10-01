import { Elysia } from 'elysia'
import { adminPhotosRoute } from './photos'
import { adminRankingsRoute } from './rankings'
import { adminEventDeleteRoute } from './eventDelete'
import { adminEventUploadRoute } from './eventUpload'

export const adminModule = new Elysia({ prefix: '/admin' })
  .use(adminPhotosRoute)
  .use(adminRankingsRoute)
  .use(adminEventDeleteRoute)
  .use(adminEventUploadRoute)
