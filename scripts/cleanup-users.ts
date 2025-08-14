#!/usr/bin/env bun

import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import getPrisma from '../src/dbConfig'
import { getR2Client } from '../src/modules/file/r2Client'

function ensureEnvVars() {
  const required = [
    'TURSO_DATABASE_URL',
    'TURSO_AUTH_TOKEN',
    'R2_ACCOUNT_ID',
    'R2_BUCKET_NAME',
    'R2_ACCESS_KEY',
    'R2_SECRET_KEY',
  ]
  
  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}.\n` +
      `Set them before running. For Workers secrets, use: wrangler secret put <NAME>`)
  }
}

async function cleanupAllUsers(): Promise<void> {
  const prisma = getPrisma()
  const { client, bucketName } = getR2Client()

  console.log('🔍 Finding all users and their photos...')
  
  // 獲取所有用戶的照片
  const photos = await prisma.photo.findMany({ 
    select: { id: true, key: true, userId: true } 
  })
  
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true }
  })

  console.log(`Found ${users.length} users and ${photos.length} photos`)

  if (users.length === 0) {
    console.log('✅ No users found, nothing to clean up')
    return
  }

  // 刪除 R2 中的照片文件
  let deletedR2Count = 0
  for (const photo of photos) {
    try {
      await client.send(new DeleteObjectCommand({ 
        Bucket: bucketName, 
        Key: photo.key 
      }))
      deletedR2Count++
      console.log(`🗑️  Deleted R2 object: ${photo.key}`)
    } catch (err) {
      console.warn(`⚠️  Failed to delete R2 object ${photo.key}:`, err)
    }
  }

  // 刪除資料庫中的照片記錄
  const deletedPhotos = await prisma.photo.deleteMany({})
  console.log(`🧹 Deleted ${deletedPhotos.count} photo records from database`)

  // 刪除用戶記錄
  const deletedUsers = await prisma.user.deleteMany({})
  console.log(`🧹 Deleted ${deletedUsers.count} user records from database`)

  console.log(`✅ Cleanup completed:`)
  console.log(`   - ${deletedR2Count} R2 objects deleted`)
  console.log(`   - ${deletedPhotos.count} photo records deleted`)
  console.log(`   - ${deletedUsers.count} user records deleted`)
}

async function main() {
  ensureEnvVars()
  
  console.log('🚀 Starting user cleanup...')
  
  // 確認操作
  const args = process.argv.slice(2)
  if (!args.includes('--confirm')) {
    console.log('⚠️  This will delete ALL users and their photos!')
    console.log('   Add --confirm flag to proceed: bun run scripts/cleanup-users.ts --confirm')
    process.exit(0)
  }

  await cleanupAllUsers()
  console.log('🎉 User cleanup completed')
}

main().catch((err) => {
  console.error('❌ Cleanup failed:', err)
  process.exit(1)
}).finally(async () => {
  await getPrisma().$disconnect()
})