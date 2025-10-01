import { Elysia } from 'elysia'
import { ratePhotoRoute } from './ratePhoto'
import { randomPhotosRoute } from './randomPhotos'

export const rateModule = new Elysia({ prefix: '/rate' })
  .use(ratePhotoRoute)
  .use(randomPhotosRoute)