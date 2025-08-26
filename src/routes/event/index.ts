import { Elysia } from 'elysia'
import { eventUploadRoute } from './upload'
import { eventListRoute } from './list'

export const eventModule = new Elysia({ prefix: '/event' })
  .use(eventUploadRoute)
  .use(eventListRoute)


