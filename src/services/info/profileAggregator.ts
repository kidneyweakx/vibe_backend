import getPrisma from '../../dbConfig'
import { getPresignedGetUrl, getPublicObjectUrl } from '../r2/presign'
import { getJourneyDashboard, type JourneyDashboard } from '../rate/journeyService'
import type { PhotoInfo, PhotoURLs, Tag } from '../interfaces/file'

const PROFILE_CACHE_TTL = 30_000

interface CacheEntry<T> {
  expiresAt: number
  data: T
}

export interface ProfileBundle {
  user: {
    id: number
    name: string | null
    avatar: string | null
    gender: string | null
    email: string | null
    provider: string | null
  }
  stats: JourneyDashboard
  photos: PhotoInfo[]
  latestPhoto: PhotoInfo | null
}

interface BundleOptions {
  page?: number
  limit?: number
  includePhotos?: boolean
}

const profileCache = new Map<string, CacheEntry<ProfileBundle>>()

function makeCacheKey(userId: string, page: number, limit: number, includePhotos: boolean) {
  return `${userId}:${page}:${limit}:${includePhotos ? 1 : 0}`
}

async function resolvePhotoUrls(key: string | null): Promise<string | null> {
  if (!key) return null
  try {
    return await getPresignedGetUrl(key, 60 * 60 * 24 * 7)
  } catch {
    return getPublicObjectUrl(key)
  }
}

async function buildPhotoInfo(photo: any): Promise<PhotoInfo> {
  const url = await resolvePhotoUrls(photo.key)
  const urls: PhotoURLs = { original: url ?? '' }

  const tags: Tag[] | undefined = photo.photoTags
    ? photo.photoTags.map((pt: any) => ({
        id: pt.tag.id,
        name: pt.tag.name,
        displayName: pt.tag.displayName,
        emoji: pt.tag.emoji ?? undefined,
        color: pt.tag.color ?? undefined,
        category: pt.tag.category ?? undefined
      }))
    : undefined

  return {
    id: photo.id,
    userId: photo.userId,
    urls,
    uploadedAt: photo.uploadedAt,
    tags
  }
}

export async function fetchProfileBundle(userId: string, options: BundleOptions = {}): Promise<ProfileBundle> {
  const page = Math.max(1, options.page ?? 1)
  const includePhotos = options.includePhotos !== false
  const requestedLimit = options.limit ?? 20
  const limit = includePhotos ? Math.min(Math.max(0, requestedLimit), 60) : 0

  const cacheKey = makeCacheKey(userId, page, limit, includePhotos)
  const cached = profileCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  const prisma = getPrisma()
  const numericId = Number(userId)
  if (!Number.isFinite(numericId)) {
    throw new Error('User not found')
  }

  const userPromise = prisma.user.findUnique({
    where: { id: numericId },
    select: {
      id: true,
      name: true,
      avatar: true,
      gender: true,
      email: true,
      provider: true
    }
  })

  const latestPhotoPromise = prisma.photo.findFirst({
    where: {
      userId: numericId,
      isProfilePicture: false
    },
    orderBy: { uploadedAt: 'desc' },
    include: {
      photoTags: {
        include: { tag: true }
      }
    }
  })

  const photosPromise = includePhotos && limit > 0
    ? prisma.photo.findMany({
        where: {
          userId: numericId,
          isProfilePicture: false
        },
        include: {
          photoTags: {
            include: { tag: true }
          }
        },
        orderBy: { uploadedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })
    : Promise.resolve([])

  const [user, latestPhotoRaw, photosRaw, journey] = await Promise.all([
    userPromise,
    latestPhotoPromise,
    photosPromise,
    getJourneyDashboard(numericId)
  ])

  if (!user) {
    throw new Error('User not found')
  }

  const avatarUrl = await resolvePhotoUrls(user.avatar ?? null)

  const latestPhoto = latestPhotoRaw ? await buildPhotoInfo(latestPhotoRaw) : null

  const photos = includePhotos && limit > 0
    ? await Promise.all(photosRaw.map((photo) => buildPhotoInfo(photo)))
    : []

  const bundle: ProfileBundle = {
    user: {
      id: user.id,
      name: user.name,
      avatar: avatarUrl,
      gender: user.gender,
      email: user.email,
      provider: user.provider
    },
    stats: journey,
    photos,
    latestPhoto
  }

  profileCache.set(cacheKey, {
    expiresAt: Date.now() + PROFILE_CACHE_TTL,
    data: bundle
  })

  return bundle
}

export function clearProfileBundleCache() {
  profileCache.clear()
}
