import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client } from '../r2/r2Client'
import { handleR2Error, logError } from './errors'

export async function testR2Config(): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, bucketName } = getR2Client()
    const command = new HeadObjectCommand({ Bucket: bucketName, Key: 'test-key-that-probably-doesnt-exist' })
    try {
      await client.send(command)
    } catch (error: any) {
      if (error.name === 'NoSuchKey') return { success: true }
      throw error
    }
    return { success: true }
  } catch (error: any) {
    logError('Config test', null, error)
    return { success: false, error: handleR2Error(error) }
  }
}


