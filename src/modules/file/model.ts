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