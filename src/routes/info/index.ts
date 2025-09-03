import { Elysia } from 'elysia'
import { homeInfoRoute } from './homeInfo'
import { journeyInfoRoute } from './journeyInfo'
import { profileInfoRoute } from './profileInfo'

export const infoModule = new Elysia({ prefix: '/info' })
  .use(homeInfoRoute)
  .use(journeyInfoRoute)
  .use(profileInfoRoute)


