#!/usr/bin/env bun
/**
 * Seed Journey Data for D1
 *
 * Generates SQL statements and executes them via wrangler d1 execute
 *
 * Usage:
 *   bun run scripts/seed-journey-data-d1.ts [userId] [weeks]
 */

import { $ } from 'bun'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'

interface DailyRatingPattern {
  likeCount: number
  normalCount: number
}

async function seedJourneyDataD1(targetUserId?: string, weeks: number = 4) {
  console.log('🌱 Starting Journey Data Seeding for D1...')
  console.log(`📊 Generating ${weeks} weeks of rating data`)

  const tempSqlFile = join(process.cwd(), 'temp-seed.sql')
  let sqlStatements: string[] = []

  // Step 1: Get target user
  let userId = targetUserId
  if (!userId) {
    console.log('🔍 Finding first non-guest user...')
    const result = await $`bunx wrangler d1 execute vibe_rank --remote --command "SELECT id, name FROM users WHERE isGuest = 0 LIMIT 1"`.text()

    // Parse user ID from wrangler output
    const lines = result.split('\n')
    const dataLine = lines.find(line => line.includes('cm') && !line.includes('id'))
    if (dataLine) {
      userId = dataLine.trim().split('│')[1]?.trim()
    }

    if (!userId) {
      console.error('❌ No non-guest user found')
      process.exit(1)
    }
  }

  console.log(`👤 Target User ID: ${userId}`)

  // Step 2: Get or create photos for target user
  console.log('📸 Checking for photos...')
  const photosResult = await $`bunx wrangler d1 execute vibe_rank --remote --command "SELECT id FROM photos WHERE userId = '${userId}' LIMIT 5"`.text()

  const photoIds: string[] = []
  const photoLines = photosResult.split('\n').filter(line => line.includes('cm') && !line.includes('id'))

  for (const line of photoLines) {
    const photoId = line.trim().split('│')[1]?.trim()
    if (photoId) photoIds.push(photoId)
  }

  // Create at least one dummy photo if none exist
  if (photoIds.length === 0) {
    console.log('📸 Creating dummy photo for ratings...')
    const dummyPhotoId = `photo_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const dummyKey = `${userId}/dummy-${Date.now()}.webp`
    sqlStatements.push(`
INSERT INTO photos (id, userId, key, url, format, size, uploadedAt)
VALUES ('${dummyPhotoId}', '${userId}', '${dummyKey}', 'https://example.com/dummy.webp', 'webp', 1024, datetime('now'));
    `.trim())
    photoIds.push(dummyPhotoId)
  }

  console.log(`✅ Using ${photoIds.length} photo(s) for ratings`)

  // Step 3: Create rater users SQL
  const raterCount = 20
  const raterIds: string[] = []

  console.log(`👥 Creating ${raterCount} rater users...`)

  for (let i = 0; i < raterCount; i++) {
    const gender = i % 2 === 0 ? 'male' : 'female'
    const name = `${gender === 'male' ? 'John' : 'Jane'} Rater ${i + 1}`
    const raterId = `rater${i}_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const email = `rater-${i}@test.com`
    const providerId = `rater-${i}@test.com`

    raterIds.push(raterId)

    sqlStatements.push(`
INSERT OR REPLACE INTO users (id, email, name, gender, provider, providerId, isGuest, createdAt, updatedAt)
VALUES ('${raterId}', '${email}', '${name}', '${gender}', 'test', '${providerId}', 0, datetime('now'), datetime('now'));
    `.trim())
  }

  // Step 4: Delete existing ratings for target user
  console.log(`🗑️  Preparing to delete existing ratings for user ${userId}`)
  sqlStatements.push(`DELETE FROM ratings WHERE ratedUserId = '${userId}';`)

  // Step 4: Generate ratings
  const today = new Date()
  const totalDays = weeks * 7
  let totalRatings = 0

  console.log(`📅 Generating ${totalDays} days of rating data...`)

  for (let dayOffset = totalDays - 1; dayOffset >= 0; dayOffset--) {
    const date = new Date(today)
    date.setDate(date.getDate() - dayOffset)
    date.setHours(0, 0, 0, 0)

    const weekNumber = Math.floor(dayOffset / 7)
    const isWeekend = date.getDay() === 0 || date.getDay() === 6

    const baseRatings = Math.floor(2 + (totalDays - dayOffset) / 7)
    const weekendBonus = isWeekend ? 1.5 : 1
    const randomVariance = 0.7 + Math.random() * 0.6

    const dailyRatingCount = Math.floor(baseRatings * weekendBonus * randomVariance)
    const likeRatio = 0.5 + (totalDays - dayOffset) / (totalDays * 2)
    const likeCount = Math.floor(dailyRatingCount * likeRatio)
    const normalCount = dailyRatingCount - likeCount

    // Generate likes
    for (let i = 0; i < likeCount; i++) {
      const rater = raterIds[Math.floor(Math.random() * raterIds.length)]
      const timestamp = new Date(date)
      timestamp.setHours(
        9 + Math.floor(Math.random() * 14),
        Math.floor(Math.random() * 60),
        Math.floor(Math.random() * 60)
      )

      const ratingId = `rating_${Date.now()}_${Math.random().toString(36).substring(7)}`
      const photoId = photoIds[Math.floor(Math.random() * photoIds.length)]
      const createdAt = timestamp.toISOString().replace('T', ' ').substring(0, 19)

      sqlStatements.push(`
INSERT OR IGNORE INTO ratings (id, raterId, ratedUserId, photoId, type, createdAt)
VALUES ('${ratingId}', '${rater}', '${userId}', '${photoId}', 'like', '${createdAt}');
      `.trim())
      totalRatings++
    }

    // Generate normals
    for (let i = 0; i < normalCount; i++) {
      const rater = raterIds[Math.floor(Math.random() * raterIds.length)]
      const timestamp = new Date(date)
      timestamp.setHours(
        9 + Math.floor(Math.random() * 14),
        Math.floor(Math.random() * 60),
        Math.floor(Math.random() * 60)
      )

      const ratingId = `rating_${Date.now()}_${Math.random().toString(36).substring(7)}`
      const photoId = photoIds[Math.floor(Math.random() * photoIds.length)]
      const createdAt = timestamp.toISOString().replace('T', ' ').substring(0, 19)

      sqlStatements.push(`
INSERT OR IGNORE INTO ratings (id, raterId, ratedUserId, photoId, type, createdAt)
VALUES ('${ratingId}', '${rater}', '${userId}', '${photoId}', 'normal', '${createdAt}');
      `.trim())
      totalRatings++
    }

    const dateStr = date.toISOString().split('T')[0]
    const score = dailyRatingCount > 0
      ? Math.round(((likeCount * 1.0 + normalCount * 0.2) / dailyRatingCount) * 100)
      : 0
    console.log(`  📅 ${dateStr}: ${dailyRatingCount} ratings (${likeCount}❤️  ${normalCount}🔄) - Score: ${score}`)
  }

  // Step 5: Write SQL to temp file
  console.log(`\n💾 Writing SQL to temporary file...`)
  const fullSql = sqlStatements.join('\n\n')
  writeFileSync(tempSqlFile, fullSql)
  console.log(`📝 Generated ${sqlStatements.length} SQL statements`)

  // Step 6: Execute via wrangler
  console.log(`\n🚀 Executing SQL on D1 remote database...`)
  try {
    await $`bunx wrangler d1 execute vibe_rank --remote --file=${tempSqlFile}`
    console.log(`\n✅ Successfully executed ${totalRatings} rating inserts!`)
  } catch (error) {
    console.error('❌ Failed to execute SQL:', error)
    process.exit(1)
  } finally {
    // Cleanup temp file
    unlinkSync(tempSqlFile)
  }

  console.log(`\n🎉 Journey data seeding complete!`)
  console.log(`📊 Total ratings created: ${totalRatings}`)
}

// Parse command line arguments
const args = process.argv.slice(2)
const userId = args[0]
const weeks = args[1] ? parseInt(args[1]) : 4

seedJourneyDataD1(userId, weeks)
  .catch(console.error)
  .finally(() => process.exit(0))
