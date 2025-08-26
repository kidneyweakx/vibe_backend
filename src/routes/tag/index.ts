import { Elysia } from 'elysia'
import { getAllTagsRoute } from './getAll'
import { getPopularTagsRoute } from './getPopular'
import { addPhotoTagsRoute } from './addPhotoTags'
import { getPhotoTagsRoute } from './getPhotoTags'
import { searchPhotosByTagsRoute } from './searchPhotos'
import { createTagRoute } from './create'

export const tagModule = new Elysia({ prefix: '/tags' })
  .use(getAllTagsRoute)
  .use(getPopularTagsRoute)
  .use(addPhotoTagsRoute)
  .use(getPhotoTagsRoute)
  .use(searchPhotosByTagsRoute)
  .use(createTagRoute)