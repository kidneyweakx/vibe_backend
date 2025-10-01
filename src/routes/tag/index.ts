import { Elysia } from 'elysia'
import { requireAuth } from '../../middlewares/auth'
import { getAllTagsRoute } from './getAll'
import { addPhotoTagsRoute } from './addPhotoTags'
import { getPhotoTagsRoute } from './getPhotoTags'
import { searchPhotosByTagsRoute } from './searchPhotos'
import { createTagRoute } from './create'

export const tagRoutes = new Elysia({ prefix: '/tags' })
  // Public routes (no auth required)
  .use(getAllTagsRoute) // GET / - List all tags
  .use(getPhotoTagsRoute) // GET /photos/:photoId - Get photo tags
  .use(searchPhotosByTagsRoute) // GET /search - Search photos by tags

  // Protected routes (auth required)
  .use(requireAuth)
  .use(createTagRoute) // POST / - Create new tag
  .use(addPhotoTagsRoute) // POST /photos/:photoId - Add tags to photo