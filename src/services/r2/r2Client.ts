import { S3Client } from '@aws-sdk/client-s3'
import { getEnvVar } from '../../env'

let r2ClientInstance: { client: S3Client; bucketName: string; accountId: string } | null = null

export const getR2Client = () => {
  if (r2ClientInstance) return r2ClientInstance

  const accountId = getEnvVar('R2_ACCOUNT_ID')
  const bucketName = getEnvVar('R2_BUCKET_NAME')
  const accessKey = getEnvVar('R2_ACCESS_KEY')
  const secretKey = getEnvVar('R2_SECRET_KEY')

  const requiredFields = {
    R2_ACCESS_KEY: accessKey,
    R2_SECRET_KEY: secretKey,
    R2_BUCKET_NAME: bucketName,
    R2_ACCOUNT_ID: accountId
  }

  const missingFields = Object.entries(requiredFields)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  if (missingFields.length > 0) {
    throw new Error(`Missing R2 config: ${missingFields.join(', ')}`)
  }

  r2ClientInstance = {
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKey!,
        secretAccessKey: secretKey!
      }
    }),
    bucketName: bucketName!,
    accountId: accountId!
  }

  return r2ClientInstance
}




