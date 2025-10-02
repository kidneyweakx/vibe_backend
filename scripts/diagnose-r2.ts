#!/usr/bin/env bun

/**
 * R2 診斷腳本 - 檢查資料庫和 R2 bucket 的同步狀態
 */

import { HeadObjectCommand } from '@aws-sdk/client-s3'
import getPrisma from '../src/dbConfig'
import { getR2Client } from '../src/services/r2/r2Client'

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

async function diagnose() {
  try {
    logger.info('Starting R2 diagnostic...')

    // 1. 檢查 R2 連線
    logger.info('Checking R2 connection...')
    const { accountId, bucketName } = getR2Client()
    logger.info('R2 Config:', { accountId, bucketName })

    // 2. 檢查資料庫中的 photos
    logger.info('Querying database for photos...')
    const photos = await getPrisma().photo.findMany({
      select: { id: true, key: true, userId: true, uploadedAt: true },
      orderBy: { uploadedAt: 'desc' },
      take: 100
    })

    logger.info(`Found ${photos.length} photos in database`)

    if (photos.length === 0) {
      logger.warn('No photos found in database!')
      return
    }

    // 3. 檢查每個 photo 是否在 R2 中存在
    logger.info('Checking photos in R2...')
    let existCount = 0
    let missingCount = 0
    const missingPhotos: typeof photos = []

    for (const photo of photos) {
      try {
        const exists = await checkPhotoInR2(photo.key)
        if (exists) {
          existCount++
          logger.info(`✓ ${photo.key}`)
        } else {
          missingCount++
          missingPhotos.push(photo)
          logger.warn(`✗ ${photo.key} - NOT FOUND in R2`)
        }
      } catch (error: any) {
        logger.error(`Error checking ${photo.key}:`, error.message)
      }
    }

    // 4. 總結
    logger.info('\n=== Diagnostic Summary ===')
    logger.info(`Total photos in DB: ${photos.length}`)
    logger.info(`Exist in R2: ${existCount}`)
    logger.info(`Missing in R2: ${missingCount}`)

    if (missingCount > 0) {
      logger.warn('\nMissing photo IDs:')
      missingPhotos.forEach(p => {
        logger.warn(`- ${p.id} (${p.key}) uploaded at ${p.uploadedAt}`)
      })

      logger.info('\nTo clean up missing photos from database, run:')
      logger.info('bun run scripts/cleanup-orphaned-photos.ts')
    } else {
      logger.info('✓ All photos in database exist in R2!')
    }

  } catch (error: any) {
    logger.error('Diagnostic failed:', error.message)
    console.error(error)
    process.exit(1)
  }
}

diagnose()
  .then(() => {
    logger.info('Diagnostic complete')
    process.exit(0)
  })
  .catch((error) => {
    logger.error('Unexpected error:', error)
    process.exit(1)
  })
