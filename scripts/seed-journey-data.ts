#!/usr/bin/env bun
/**
 * Seed Journey Data Script
 *
 * Generates realistic rating data spanning multiple weeks for testing journey charts.
 *
 * Usage:
 *   bun run scripts/seed-journey-data.ts [userId] [weeks]
 *
 * To use with remote D1 (via Turso):
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." bun run scripts/seed-journey-data.ts
 *
 * Arguments:
 *   userId - Target user ID to generate ratings for (optional, uses first non-guest user if not provided)
 *   weeks  - Number of weeks to generate data for (default: 4)
 */

import getPrisma from '../src/dbConfig'

interface DailyRatingPattern {
  likeCount: number
  normalCount: number
}

async function seedJourneyData(targetUserId?: string, weeks: number = 4) {
  const prisma = getPrisma()

  console.log('🌱 Starting Journey Data Seeding...')
  console.log(`📊 Generating ${weeks} weeks of rating data`)

  // Find target user
  let user = targetUserId
    ? await prisma.user.findUnique({ where: { id: targetUserId } })
    : await prisma.user.findFirst({ where: { isGuest: false } })

  if (!user) {
    console.error('❌ No user found')
    process.exit(1)
  }

  console.log(`👤 Target User: ${user.name} (${user.id})`)

  // Find or create rater users (will be the ones giving ratings)
  const raterCount = 20
  const raters = []

  for (let i = 0; i < raterCount; i++) {
    const gender = i % 2 === 0 ? 'male' : 'female'
    const name = `${gender === 'male' ? 'John' : 'Jane'} Rater ${i + 1}`

    const rater = await prisma.user.upsert({
      where: {
        provider_providerId: {
          provider: 'test',
          providerId: `rater-${i}@test.com`
        }
      },
      create: {
        email: `rater-${i}@test.com`,
        name,
        gender,
        provider: 'test',
        providerId: `rater-${i}@test.com`,
        isGuest: false
      },
      update: {}
    })

    raters.push(rater)
  }

  console.log(`✅ Created/found ${raters.length} rater users`)

  // Delete existing ratings for this user to start fresh
  const deleted = await prisma.rating.deleteMany({
    where: { ratedUserId: user.id }
  })
  console.log(`🗑️  Deleted ${deleted.count} existing ratings`)

  // Generate rating pattern with realistic progression
  const today = new Date()
  const totalDays = weeks * 7
  let createdCount = 0

  for (let dayOffset = totalDays - 1; dayOffset >= 0; dayOffset--) {
    const date = new Date(today)
    date.setDate(date.getDate() - dayOffset)
    date.setHours(0, 0, 0, 0)

    // Create realistic daily pattern
    // Earlier weeks: lower engagement
    // Recent weeks: higher engagement with some variance
    const weekNumber = Math.floor(dayOffset / 7)
    const isWeekend = date.getDay() === 0 || date.getDay() === 6

    // Base rating count increases over time
    const baseRatings = Math.floor(2 + (totalDays - dayOffset) / 7)
    const weekendBonus = isWeekend ? 1.5 : 1
    const randomVariance = 0.7 + Math.random() * 0.6 // 0.7 - 1.3x

    const dailyRatingCount = Math.floor(baseRatings * weekendBonus * randomVariance)

    // Quality improves over time (more likes, less normals)
    const likeRatio = 0.5 + (totalDays - dayOffset) / (totalDays * 2) // 0.5 -> 1.0
    const likeCount = Math.floor(dailyRatingCount * likeRatio)
    const normalCount = dailyRatingCount - likeCount

    // Create ratings for this day
    const dayRatings = []

    // Add likes
    for (let i = 0; i < likeCount; i++) {
      const rater = raters[Math.floor(Math.random() * raters.length)]
      const timestamp = new Date(date)
      timestamp.setHours(
        9 + Math.floor(Math.random() * 14), // 9am - 11pm
        Math.floor(Math.random() * 60),
        Math.floor(Math.random() * 60)
      )

      dayRatings.push({
        raterId: rater.id,
        ratedUserId: user.id,
        photoId: 'seed-photo-' + Math.random().toString(36).substring(7),
        type: 'like',
        createdAt: timestamp
      })
    }

    // Add normals
    for (let i = 0; i < normalCount; i++) {
      const rater = raters[Math.floor(Math.random() * raters.length)]
      const timestamp = new Date(date)
      timestamp.setHours(
        9 + Math.floor(Math.random() * 14),
        Math.floor(Math.random() * 60),
        Math.floor(Math.random() * 60)
      )

      dayRatings.push({
        raterId: rater.id,
        ratedUserId: user.id,
        photoId: 'seed-photo-' + Math.random().toString(36).substring(7),
        type: 'normal',
        createdAt: timestamp
      })
    }

    // Batch create ratings for the day
    if (dayRatings.length > 0) {
      await prisma.rating.createMany({
        data: dayRatings
      })
      createdCount += dayRatings.length

      const dateStr = date.toISOString().split('T')[0]
      const score = dailyRatingCount > 0
        ? Math.round(((likeCount * 1.0 + normalCount * 0.2) / dailyRatingCount) * 100)
        : 0
      console.log(`  📅 ${dateStr}: ${dailyRatingCount} ratings (${likeCount}❤️  ${normalCount}🔄) - Score: ${score}`)
    }
  }

  console.log(`\n✅ Created ${createdCount} ratings across ${totalDays} days`)

  // Calculate final stats
  const totalLikes = await prisma.rating.count({
    where: { ratedUserId: user.id, type: 'like' }
  })
  const totalNormals = await prisma.rating.count({
    where: { ratedUserId: user.id, type: 'normal' }
  })
  const totalRatings = totalLikes + totalNormals
  const finalScore = totalRatings > 0
    ? Math.round(((totalLikes * 1.0 + totalNormals * 0.2) / totalRatings) * 100)
    : 0

  console.log(`\n📈 Final Stats for ${user.name}:`)
  console.log(`   Total Ratings: ${totalRatings}`)
  console.log(`   Likes: ${totalLikes}`)
  console.log(`   Normals: ${totalNormals}`)
  console.log(`   Score: ${finalScore}`)
  console.log(`\n🎉 Journey data seeding complete!`)
}

// Parse command line arguments
const args = process.argv.slice(2)
const userId = args[0]
const weeks = args[1] ? parseInt(args[1]) : 4

seedJourneyData(userId, weeks)
  .catch(console.error)
  .finally(() => process.exit(0))
