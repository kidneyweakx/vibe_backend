import { Elysia } from 'elysia'
import { requireAuth } from '../../middlewares/auth'
import { getProfileRoute } from './getProfile'
import { updateProfileRoute } from './updateProfile'
import { profilePictureRoute } from './profilePicture'
import { deleteAccountRoute } from './delete'
import { onboardingRoute } from './onboarding'

const protectedUserRoutes = requireAuth(new Elysia())
  .use(getProfileRoute) // GET /profile/:id - Full profile (own only)
  .use(updateProfileRoute) // PUT /profile/:id - Update own profile
  .use(profilePictureRoute) // POST /profile-picture - Upload profile pic
  .use(deleteAccountRoute) // DELETE /account - Delete own account

export const userRoutes = new Elysia({ prefix: '/user' })
  // Public routes (no auth required)
  .use(onboardingRoute) // POST /onboard - Complete onboarding
  
  // Protected routes (auth required)
  .use(protectedUserRoutes)