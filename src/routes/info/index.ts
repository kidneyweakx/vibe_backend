import { Elysia } from 'elysia'
import { homeInfoRoute } from './homeInfo'

export const infoModule = new Elysia({ prefix: '/info' })
  .use(homeInfoRoute)
