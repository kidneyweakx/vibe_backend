import { Elysia } from 'elysia'
import { homeInfoRoute } from './homeInfo'
import { journeyInfoRoute } from './journeyInfo'

export const infoModule = new Elysia({ prefix: '/info' })
  .use(homeInfoRoute)
  .use(journeyInfoRoute)


