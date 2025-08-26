import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client } from '../r2/r2Client'

export async function verifyFile(key: string): Promise<boolean> {
  try {
    const { client, bucketName } = getR2Client()
    const command = new HeadObjectCommand({ Bucket: bucketName, Key: key })
    await client.send(command)
    return true
  } catch {
    return false
  }
}


