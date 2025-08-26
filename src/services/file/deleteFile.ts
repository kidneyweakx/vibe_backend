import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client } from '../r2/r2Client'
import { handleR2Error, logError } from './errors'

export async function deleteFile(key: string): Promise<{ success: boolean; error?: string }> {
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


