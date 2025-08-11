import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getR2Client } from './r2Client'

export const getPublicObjectUrl = (key: string): string => {
  const { accountId, bucketName } = getR2Client()
  return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`
}

export const getPresignedGetUrl = async (key: string, expiresInSeconds: number = 3600): Promise<string> => {
  const { client, bucketName } = getR2Client()
  const command = new GetObjectCommand({ Bucket: bucketName, Key: key })
  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds })
}

export const getPresignedPutUrl = async (
  key: string,
  contentType?: string,
  expiresInSeconds: number = 3600
): Promise<string> => {
  const { client, bucketName } = getR2Client()
  const command = new PutObjectCommand({ Bucket: bucketName, Key: key, ContentType: contentType })
  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds })
}


