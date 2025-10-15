#!/usr/bin/env bun
/**
 * Enhanced Fake Photos Import Script
 *
 * Imports photos from fake-data directory with improved error handling,
 * progress tracking, and batch processing
 *
 * Usage:
 *   bun run scripts/import-fake-photos.ts [--limit=20] [--batch-size=5] [--quality=85] [--dry-run]
 */

import { readdir, readFile, stat, writeFile } from 'fs/promises'
import { join, basename } from 'path'
import { randomBytes } from 'crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import type { Photo, User } from '@prisma/client'
import getPrisma from '../src/dbConfig'
import { getR2Client } from '../src/services/r2/r2Client'
import { getPublicObjectUrl } from '../src/services/r2/presign'
import { generateName } from './name-generator'
import sharp from 'sharp'
import { nanoid } from 'nanoid'
import { getD1DbName, d1InsertUserAndPhoto } from './lib/d1'

const FAKE_DATA_DIR = '/Users/kidney/Workspace/Work/vibe/fake-data'
const GENDERS = ['male', 'female'] as const
const MIME_TYPES: Record<string, string> = {
  webp: 'image/webp'
}

type Gender = typeof GENDERS[number]

interface PhotoFile {
  path: string
  filename: string
  gender: Gender
  size: number
}

interface ImportOptions {
  limit?: number
  batchSize: number
  dryRun: boolean
  skipExisting: boolean
  quality: number
  d1: boolean
  d1Db?: string
  env?: 'test' | 'production'
}

interface ImportStats {
  totalFiles: number
  processed: number
  successful: number
  failed: number
  skipped: number
  usersCreated: number
  photosCreated: number
  startTime: number
  totalOriginalSize: number
  totalCompressedSize: number
}

const parseArgs = (): ImportOptions => {
  const args = process.argv.slice(2)
  const limitArg = args.find(arg => arg.startsWith('--limit='))
  const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='))
  const qualityArg = args.find(arg => arg.startsWith('--quality='))
  const d1DbArg = args.find(arg => arg.startsWith('--d1-db='))
  const envArg = args.find(arg => arg.startsWith('--env='))
  
  const limitValue = limitArg ? Number.parseInt(limitArg.split('=')[1] ?? '', 10) : undefined
  const batchSizeValue = batchSizeArg ? Number.parseInt(batchSizeArg.split('=')[1] ?? '', 10) : 5
  const qualityValue = qualityArg ? Number.parseInt(qualityArg.split('=')[1] ?? '', 10) : 85
  const d1DbValue = d1DbArg ? d1DbArg.split('=')[1] : undefined
  const envValue = envArg ? (envArg.split('=')[1] as 'test' | 'production') : undefined
  
  return {
    limit: Number.isFinite(limitValue) && limitValue! > 0 ? limitValue : undefined,
    batchSize: Number.isFinite(batchSizeValue) && batchSizeValue! > 0 ? batchSizeValue : 5,
    dryRun: args.includes('--dry-run'),
    skipExisting: args.includes('--skip-existing'),
    quality: Number.isFinite(qualityValue) && qualityValue! > 0 && qualityValue! <= 100 ? qualityValue : 85,
    d1: args.includes('--d1'),
    d1Db: d1DbValue,
    env: envValue
  }
}

async function getPhotoFiles(): Promise<PhotoFile[]> {
  const files: PhotoFile[] = []

  for (const gender of GENDERS) {
    try {
      const genderDir = join(FAKE_DATA_DIR, gender)
      const filenames = await readdir(genderDir)

      const photoFiles = await Promise.all(
        filenames
          .filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i))
          .map(async filename => {
            const path = join(genderDir, filename)
            const stats = await stat(path)
            return {
              path,
              filename,
              gender,
              size: stats.size
            }
          })
      )

      files.push(...photoFiles)
    } catch (error) {
      console.warn(`⚠️  Warning: Could not read ${gender} directory:`, error)
    }
  }

  return files
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function getFileExtension(filename: string): string {
  return 'webp' // Always use webp after compression
}

function generatePhotoKey(userId: string, extension: string): string {
  const timestamp = Date.now()
  const random = randomBytes(4).toString('hex')
  return `fake/${userId}/${timestamp}-${random}.${extension}`
}

async function compressImageToWebP(inputPath: string, quality: number = 85): Promise<Uint8Array> {
  try {
    const compressed = await sharp(inputPath)
      .resize(800, 800, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .webp({ 
        quality,
        effort: 6 // Higher effort for better compression
      })
      .toBuffer()
    
    return new Uint8Array(compressed)
  } catch (error) {
    console.error('Failed to compress image:', error)
    throw error
  }
}

async function uploadFileToR2(key: string, data: Uint8Array, contentType: string) {
  const { client, bucketName } = getR2Client()
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: data,
    ContentType: contentType
  })
  await client.send(command)
}

// D1 helpers moved to scripts/lib/d1.ts

function randomTakenAt(): Date {
  const now = Date.now()
  const thirtyDays = 1000 * 60 * 60 * 24 * 30
  return new Date(now - Math.floor(Math.random() * thirtyDays))
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

function createProgressBar(current: number, total: number, width: number = 30): string {
  const percentage = Math.round((current / total) * 100)
  const filled = Math.round((current / total) * width)
  const empty = width - filled
  
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`
}

async function checkExistingUser(prisma: any, email: string): Promise<boolean> {
  try {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    })
    return !!existing
  } catch {
    return false
  }
}

async function importPhotos() {
  const options = parseArgs()
  const usingD1 = options.d1 === true
  const dbName = usingD1 ? getD1DbName(options) : ''
  const prisma = usingD1 ? null as any : getPrisma()
  const stats: ImportStats = {
    totalFiles: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    usersCreated: 0,
    photosCreated: 0,
    startTime: Date.now(),
    totalOriginalSize: 0,
    totalCompressedSize: 0
  }

  console.log('📸 Enhanced Fake Photo Import Script')
  console.log('=====================================\n')

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No actual changes will be made\n')
  }

  try {
    const allPhotoFiles = await getPhotoFiles()
    const shuffled = shuffle(allPhotoFiles)
    const selectedPhotos = options.limit ? shuffled.slice(0, options.limit) : shuffled

    stats.totalFiles = selectedPhotos.length

    console.log(`📁 Found ${allPhotoFiles.length} candidate photos:`)
    console.log(`   - Male: ${allPhotoFiles.filter(p => p.gender === 'male').length}`)
    console.log(`   - Female: ${allPhotoFiles.filter(p => p.gender === 'female').length}`)
    console.log(`   - Total size: ${formatBytes(allPhotoFiles.reduce((sum, p) => sum + p.size, 0))}`)
    
    if (options.limit) {
      console.log(`\n⚙️  Limit applied: importing ${selectedPhotos.length} photos`)
    }
    
    console.log(`\n🚀 Starting import with batch size: ${options.batchSize}`)
    console.log(`📸 WebP compression quality: ${options.quality}%`)
    console.log(usingD1 ? `🗄️  Target DB: D1 (${dbName})` : `🗄️  Target DB: local (Prisma DATABASE_URL)`)
    console.log('')

    // Process in batches
    for (let i = 0; i < selectedPhotos.length; i += options.batchSize) {
      const batch = selectedPhotos.slice(i, i + options.batchSize)
      const batchNumber = Math.floor(i / options.batchSize) + 1
      const totalBatches = Math.ceil(selectedPhotos.length / options.batchSize)

      console.log(`\n📦 Batch ${batchNumber}/${totalBatches} (${batch.length} photos)`)
      
      const batchPromises = batch.map(async (photoFile, index) => {
        const globalIndex = i + index + 1
        const { filename, gender, path, size } = photoFile
        const name = generateName({ gender })

        const uniqueToken = randomBytes(4).toString('hex')
        const sanitizedName = name.toLowerCase().replace(/[^a-z]/g, '')
        const email = `${sanitizedName || 'user'}${uniqueToken}@example.com`
        const providerId = `fake-${uniqueToken}`

        // Check if user already exists (if skip-existing is enabled)
        if (!usingD1) {
          if (options.skipExisting) {
            const exists = await checkExistingUser(prisma, email)
            if (exists) {
              stats.skipped++
              console.log(`   ⏭️  [${globalIndex}/${stats.totalFiles}] Skipped existing user: ${name}`)
              return
            }
          }
        }

        if (options.dryRun) {
          console.log(`   🔍 [${globalIndex}/${stats.totalFiles}] [DRY RUN] Would create: ${name} (${gender}) - ${formatBytes(size)} → WebP (compressed)`)
          stats.successful++
          return
        }

        let user: User | null = null
        const userIdForD1 = usingD1 ? nanoid() : undefined
        try {
          if (!usingD1) {
            user = await prisma.user.create({
              data: {
                email,
                name,
                gender,
                provider: 'test',
                providerId,
                isGuest: false,
                eloRating: 1500.0,
                totalScore: 0,
                likeCount: 0,
                normalCount: 0,
                totalRatings: 0,
                isDeleted: false
              }
            })
          }

          const extension = getFileExtension(filename)
          const contentType = MIME_TYPES[extension] || 'image/webp'
          const userIdStr = usingD1 ? String(userIdForD1) : String(user!.id)
          const photoKey = generatePhotoKey(userIdStr, extension)
          
          // Compress image to WebP format
          const compressedData = await compressImageToWebP(path, options.quality)
          const originalSize = (await stat(path)).size
          const compressedSize = compressedData.byteLength
          const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1)

          await uploadFileToR2(photoKey, compressedData, contentType)
          const publicUrl = getPublicObjectUrl(photoKey)

          if (!usingD1) {
            await prisma.photo.create({
              data: {
                userId: user!.id,
                key: photoKey,
                url: publicUrl,
                format: extension,
                size: compressedData.byteLength,
                status: 'active',
                isProfilePicture: false,
                takenAt: randomTakenAt()
              }
            })
          } else {
            const uid = userIdStr
            const pid = nanoid()
            const nowIso = new Date().toISOString()
            await d1InsertUserAndPhoto(dbName, {
              id: uid,
              email,
              name,
              gender,
              provider: 'test',
              providerId,
              passwordHash: null,
              bio: null,
              location: null,
              language: null,
              timezone: null,
              notificationsEnabled: 0,
              isGuest: 0,
              isDeleted: 0,
              createdAt: nowIso,
              updatedAt: nowIso,
              eloRating: 1500.0,
              totalScore: 0,
              likeCount: 0,
              normalCount: 0,
              totalRatings: 0
            }, {
              id: pid,
              userId: uid,
              key: photoKey,
              url: publicUrl,
              format: extension,
              size: compressedData.byteLength,
              status: 'active',
              isProfilePicture: 0,
              takenAt: nowIso,
              uploadedAt: nowIso
            })
          }

          stats.usersCreated++
          stats.photosCreated++
          stats.successful++
          stats.totalOriginalSize += originalSize
          stats.totalCompressedSize += compressedSize
          console.log(`   ✅ [${globalIndex}/${stats.totalFiles}] ${name} (${gender}) - ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${compressionRatio}% smaller)`)
        } catch (error) {
          stats.failed++
          console.error(`   ❌ [${globalIndex}/${stats.totalFiles}] Failed ${name}:`, error instanceof Error ? error.message : error)
          
          if (user && !usingD1) {
            try {
              await prisma.user.delete({ where: { id: user.id } })
            } catch (cleanupError) {
              console.error('   ⚠️  Failed to clean up user after error:', cleanupError)
            }
          }
        }
      })

      await Promise.all(batchPromises)
      stats.processed += batch.length

      // Show progress
      const progress = createProgressBar(stats.processed, stats.totalFiles)
      const elapsed = Date.now() - stats.startTime
      const eta = stats.processed > 0 ? (elapsed / stats.processed) * (stats.totalFiles - stats.processed) : 0
      
      console.log(`   ${progress} | ${stats.processed}/${stats.totalFiles} | ETA: ${formatDuration(eta)}`)
    }

    const totalTime = Date.now() - stats.startTime
    const rate = stats.processed > 0 ? (stats.processed / (totalTime / 1000)).toFixed(2) : 0

    console.log('\n✨ Import completed!')
    console.log('==================')
    console.log(`📊 Statistics:`)
    console.log(`   - Total files: ${stats.totalFiles}`)
    console.log(`   - Processed: ${stats.processed}`)
    console.log(`   - Successful: ${stats.successful}`)
    console.log(`   - Failed: ${stats.failed}`)
    console.log(`   - Skipped: ${stats.skipped}`)
    console.log(`   - Users created: ${stats.usersCreated}`)
    console.log(`   - Photos created: ${stats.photosCreated}`)
    console.log(`   - Processing rate: ${rate} files/sec`)
    console.log(`   - Total time: ${formatDuration(totalTime)}`)
    
    if (stats.totalOriginalSize > 0) {
      const totalCompressionRatio = ((stats.totalOriginalSize - stats.totalCompressedSize) / stats.totalOriginalSize * 100).toFixed(1)
      console.log(`\n📸 Compression statistics:`)
      console.log(`   - Original total size: ${formatBytes(stats.totalOriginalSize)}`)
      console.log(`   - Compressed total size: ${formatBytes(stats.totalCompressedSize)}`)
      console.log(`   - Space saved: ${formatBytes(stats.totalOriginalSize - stats.totalCompressedSize)} (${totalCompressionRatio}%)`)
    }

    if (stats.usersCreated > 0) {
      console.log('\n👥 Gender distribution:')
      console.log(`   - Male users: ${stats.usersCreated / 2} (estimated)`)
      console.log(`   - Female users: ${stats.usersCreated / 2} (estimated)`)
    }

  } catch (error) {
    console.error('\n❌ Import failed:', error)
    throw error
  } finally {
    try {
      // Only disconnect when using local Prisma (not D1 mode)
      if (prisma && typeof prisma.$disconnect === 'function') {
        await prisma.$disconnect()
      }
    } catch {}
  }
}

importPhotos().catch(error => {
  console.error('Import failed:', error)
  process.exitCode = 1
})
