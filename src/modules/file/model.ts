export interface R2UploadResult {
  success: boolean
  url?: string
  key?: string
  error?: string
}

export interface UploadOptions {
  key?: string
  maxSize?: number
  allowedTypes?: string[]
}

export interface PhotoUploadResponse {
  photoId: string
  urls: PhotoURLs
  uploadedAt: Date
}

export interface PhotoListResponse {
  photos: PhotoInfo[]
  totalCount: number
  hasMore: boolean
}

export interface PhotoInfo {
  id: string
  userId: string
  urls: PhotoURLs
  uploadedAt: Date
}

export interface PhotoURLs {
  original: string
  thumbnail?: string
}