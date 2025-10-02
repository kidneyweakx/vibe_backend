import { Elysia } from 'elysia'
import { requireAuth } from '../../middlewares/auth'
import { getProfileRoute } from './getProfile'
import { getInfoRoute } from './getInfo'
import { updateProfileRoute } from './updateProfile'
import { getShareRoute } from './getShare'
import { getQrRoute } from './getQr'
import { profilePictureRoute } from './profilePicture'
import { deleteAccountRoute } from './delete'

const protectedUserRoutes = requireAuth(new Elysia())
  .use(getProfileRoute) // GET /profile/:id - Full profile (own only)
  .use(updateProfileRoute) // PUT /profile/:id - Update own profile
  .use(getShareRoute) // GET /share/:userId - Generate share link
  .use(getQrRoute) // GET /qr/:userId - Generate QR code
  .use(profilePictureRoute) // POST /profile-picture - Upload profile pic
  .use(deleteAccountRoute) // DELETE /account - Delete own account

export const userRoutes = new Elysia({ prefix: '/user' })
  // Public routes (no auth required)
  .use(getInfoRoute) // GET /info/:id - Public profile info

  // Protected routes (auth required)
  .use(protectedUserRoutes)