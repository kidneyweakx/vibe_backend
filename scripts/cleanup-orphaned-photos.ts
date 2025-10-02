#!/usr/bin/env bun

/**
 * 清理資料庫中沒有對應 R2 檔案的 photo 記錄
 */

import { HeadObjectCommand } from '@aws-sdk/client-s3'
import getPrisma from '../src/dbConfig'
import { getR2Client } from '../src/services/r2/r2Client'

const DRY_RUN = process.argv.includes('--dry-run')

const logger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || '')
}

async function checkPhotoInR2(key: string): Promise<boolean> {
  try {
    const { client, bucketName } = getR2Client()
    const command = new HeadObjectCommand({ Bucket: bucketName, Key: key })
    await client.send(command)
    return true
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false
    }
    throw error
  }
}

async function cleanup() {
  logger.info(DRY_RUN ? 'Running in DRY RUN mode (no changes will be made)' : 'Running in LIVE mode')

  try {
    const photos = await getPrisma().photo.findMany({
      select: { id: true, key: true, userId: true },
      orderBy: { uploadedAt: 'desc' }
    })

    logger.info(`Checking ${photos.length} photos...`)

    const toDelete: string[] = []

    for (const photo of photos) {
      const exists = await checkPhotoInR2(photo.key)
      if (!exists) {
        logger.warn(`Missing in R2: ${photo.id} (${photo.key})`)
        toDelete.push(photo.id)
      }
    }

    if (toDelete.length === 0) {
      logger.info('No orphaned photos found!')
      return
    }

    logger.warn(`Found ${toDelete.length} orphaned photos`)

    if (DRY_RUN) {
      logger.info('Would delete the following photo IDs:')
      toDelete.forEach(id => logger.info(`- ${id}`))
      logger.info('\nTo actually delete, run without --dry-run flag')
    } else {
      logger.warn('Deleting orphaned photos from database...')
      const result = await getPrisma().photo.deleteMany({
        where: { id: { in: toDelete } }
      })
      logger.info(`Deleted ${result.count} photos`)
    }

  } catch (error: any) {
    logger.error('Cleanup failed:', error.message)
    console.error(error)
    process.exit(1)
  }
}

cleanup()
  .then(() => {
    logger.info('Cleanup complete')
    process.exit(0)
  })
  .catch((error) => {
    logger.error('Unexpected error:', error)
    process.exit(1)
  })
