import { Elysia } from 'elysia'
import { requireAuth } from '../../middlewares/auth'
import { getAllTagsRoute } from './getAll'
import { addPhotoTagsRoute } from './addPhotoTags'
import { getPhotoTagsRoute } from './getPhotoTags'
import { searchPhotosByTagsRoute } from './searchPhotos'

const protectedTagRoutes = requireAuth(new Elysia())
  .use(addPhotoTagsRoute) // POST /photos/:photoId - Add tags to photo (user can tag their own photos)

export const tagRoutes = new Elysia({ prefix: '/tags' })
  // Public routes (no auth required)
  .use(getAllTagsRoute) // GET / - List all tags
  .use(getPhotoTagsRoute) // GET /photos/:photoId - Get photo tags
  .use(searchPhotosByTagsRoute) // GET /search - Search photos by tags

  // Protected routes (auth required)
  .use(protectedTagRoutes)