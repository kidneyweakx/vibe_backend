import { Elysia } from 'elysia'
import { getProfileRoute } from './getProfile'
import { getInfoRoute } from './getInfo'
import { updateProfileRoute } from './updateProfile'
import { getShareRoute } from './getShare'
import { getQrRoute } from './getQr'
import { createTestUserRoute } from './createTest'
import { legacyUserRoutes } from './legacy'

export const userRoutes = new Elysia({ prefix: '/user' })
  .use(getProfileRoute)
  .use(getInfoRoute)
  .use(updateProfileRoute)
  .use(getShareRoute)
  .use(getQrRoute)
  .use(createTestUserRoute)
  .use(legacyUserRoutes)