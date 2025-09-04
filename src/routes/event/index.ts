import { Elysia } from 'elysia'
import { eventUploadRoute } from './upload'
import { eventListRoute } from './list'
import { eventDeleteRoute } from './delete'

export const eventModule = new Elysia({ prefix: '/event' })
  .use(eventUploadRoute)
  .use(eventListRoute)
  .use(eventDeleteRoute)


