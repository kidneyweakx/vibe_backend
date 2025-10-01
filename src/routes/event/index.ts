import { Elysia } from 'elysia'
import { eventListRoute } from './list'

export const eventModule = new Elysia({ prefix: '/event' })
  .use(eventListRoute)


