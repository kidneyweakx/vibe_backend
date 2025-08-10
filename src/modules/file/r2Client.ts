import { S3Client } from '@aws-sdk/client-s3'
import { get_config } from '../../config'

export const getR2Client = () => {
  const config = get_config()

  const requiredFields = {
    R2_ACCESS_KEY: config.R2_ACCESS_KEY,
    R2_SECRET_KEY: config.R2_SECRET_KEY,
    R2_BUCKET_NAME: config.R2_BUCKET_NAME,
    R2_ACCOUNT_ID: config.R2_ACCOUNT_ID
  }

  const missingFields = Object.entries(requiredFields)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

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


