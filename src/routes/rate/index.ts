import { Elysia } from 'elysia'
import { requireAuth } from '../../middlewares/auth'
import { ratePhotoRoute } from './ratePhoto'
import { randomPhotosRoute } from './randomPhotos'

export const rateModule = new Elysia({ prefix: '/rate' })
  .use(requireAuth)
  .use(ratePhotoRoute) // POST /photo
  .use(randomPhotosRoute) // GET /random