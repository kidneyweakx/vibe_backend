import { Elysia } from 'elysia'
import { getAllTagsRoute } from './getAll'
import { addPhotoTagsRoute } from './addPhotoTags'
import { getPhotoTagsRoute } from './getPhotoTags'
import { searchPhotosByTagsRoute } from './searchPhotos'
import { createTagRoute } from './create'

export const tagRoutes = new Elysia({ prefix: '/tags' })
  .use(getAllTagsRoute)
  .use(createTagRoute)
  .use(addPhotoTagsRoute)
  .use(getPhotoTagsRoute)
  .use(searchPhotosByTagsRoute)