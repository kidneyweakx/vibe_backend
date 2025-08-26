import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client } from '../r2/r2Client'
import { getPresignedGetUrl, getPublicObjectUrl } from '../r2/presign'
import { handleR2Error, logError } from './errors'
import type { R2UploadResult, UploadOptions } from '../interfaces/file'

const validateFile = (file: File, options: UploadOptions = {}): string | null => {
  const allowedTypes = options.allowedTypes || ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const maxSize = options.maxSize || 10 * 1024 * 1024
  if (!allowedTypes.includes(file.type)) return 'Invalid file type. Only images are allowed'
  if (file.size > maxSize) return 'File size exceeds limit'
  return null
}

export async function uploadToR2(file: File, options: UploadOptions = {}): Promise<R2UploadResult> {
  try {
    const validationError = validateFile(file, options)
    if (validationError) return { success: false, error: validationError }

    const { client, bucketName } = getR2Client()
    const fileKey = options.key || `uploads/${Date.now()}-${file.name}`
    const arrayBuffer = await file.arrayBuffer()
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      Body: new Uint8Array(arrayBuffer),
      ContentType: file.type,
      ContentLength: file.size
    })
    await client.send(command)
    const publicUrl = getPublicObjectUrl(fileKey)
    const signedUrl = await getPresignedGetUrl(fileKey, 60 * 60 * 24 * 7)
    return { success: true, url: publicUrl, key: fileKey, signedUrl: signedUrl as any }
  } catch (error: any) {
    logError('Upload', null, error)
    return { success: false, error: handleR2Error(error) }
  }
}


