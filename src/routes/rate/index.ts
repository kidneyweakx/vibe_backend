import { Elysia } from 'elysia'
import { ratePhotoRoute } from './ratePhoto'
import { userStatsRoute } from './userStats'
import { rankingsRoute } from './rankings'
import { randomPhotosRoute } from './randomPhotos'

export const rateModule = new Elysia({ prefix: '/rate' })
  .use(ratePhotoRoute)
  .use(userStatsRoute)
  .use(rankingsRoute)
  .use(randomPhotosRoute)