import { Elysia } from 'elysia'
import { getProfileRoute } from './getProfile'
import { getInfoRoute } from './getInfo'
import { updateProfileRoute } from './updateProfile'
import { getShareRoute } from './getShare'
import { getQrRoute } from './getQr'
import { profilePictureRoute } from './profilePicture'
import { deleteAccountRoute } from './delete'

export const userRoutes = new Elysia({ prefix: '/user' })
  .use(getProfileRoute)
  .use(getInfoRoute)
  .use(updateProfileRoute)
  .use(getShareRoute)
  .use(getQrRoute)
  .use(profilePictureRoute)
  .use(deleteAccountRoute)