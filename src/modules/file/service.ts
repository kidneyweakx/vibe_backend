import { get_config } from '../../config'
import { R2UploadResult, UploadOptions } from './model'
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { handleR2Error, logError } from './errors'

const getR2Client = () => {
  const config = get_config()
  
  const requiredFields = {
    R2_ACCESS_KEY: config.R2_ACCESS_KEY,
    R2_SECRET_KEY: config.R2_SECRET_KEY,
    R2_ENDPOINT: config.R2_ENDPOINT,
    R2_BUCKET_NAME: config.R2_BUCKET_NAME,
    R2_ACCOUNT_ID: config.R2_ACCOUNT_ID
  }
  
  const missingFields = Object.entries(requiredFields)
    .filter(([_, value]) => !value)
    .map(([key, _]) => key)
  
  if (missingFields.length > 0) {
    throw new Error(`Missing R2 config: ${missingFields.join(', ')}`)
  }
  
  return {
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY!,
        secretAccessKey: config.R2_SECRET_KEY!
      }
    }),
    bucketName: config.R2_BUCKET_NAME!,
    accountId: config.R2_ACCOUNT_ID!
  }
}

const validateFile = (file: File, options: UploadOptions = {}): string | null => {
  const allowedTypes = options.allowedTypes || ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const maxSize = options.maxSize || 10 * 1024 * 1024 // 10MB
  
  if (!allowedTypes.includes(file.type)) {
    return 'Invalid file type. Only images are allowed'
  }
  
  if (file.size > maxSize) {
    return 'File size exceeds limit'
  }
  
  return null
}

export const uploadToR2 = async (file: File, options: UploadOptions = {}): Promise<R2UploadResult> => {
  try {
    const validationError = validateFile(file, options)
    if (validationError) {
      return { success: false, error: validationError }
    }

    const { client, bucketName, accountId } = getR2Client()
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
    
    return {
      success: true,
      url: `https://pub-${accountId}.r2.dev/${fileKey}`,
      key: fileKey
    }
    
  } catch (error: any) {
    logError('Upload', null, error)
    return { success: false, error: handleR2Error(error) }
  }
}

export const verifyFile = async (key: string): Promise<boolean> => {
  try {
    const { client, bucketName } = getR2Client()
    const command = new HeadObjectCommand({ Bucket: bucketName, Key: key })
    await client.send(command)
    return true
  } catch {
    return false
  }
}

export const deleteFile = async (key: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { client, bucketName } = getR2Client()
    const command = new DeleteObjectCommand({ Bucket: bucketName, Key: key })
    await client.send(command)
    return { success: true }
  } catch (error: any) {
    logError('Delete', key, error)
    return { success: false, error: handleR2Error(error) }
  }
}

export const testR2Config = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const { client, bucketName } = getR2Client()
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: 'test-key-that-probably-doesnt-exist'
    })
    
    try {
      await client.send(command)
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return { success: true }
      }
      throw error
    }
    
    return { success: true }
  } catch (error: any) {
    logError('Config test', null, error)
    return { success: false, error: handleR2Error(error) }
  }
}