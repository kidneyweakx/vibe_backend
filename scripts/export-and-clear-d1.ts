#!/usr/bin/env bun
/**
 * Export and Clear D1 Database
 *
 * 1. Exports the remote D1 database to a SQL file
 * 2. Clears all data from all tables
 *
 * Usage:
 *   bun run scripts/export-and-clear-d1.ts [--env production] [--skip-export] [--yes]
 *
 * Options:
 *   --env production    Use production environment (default: staging)
 *   --skip-export       Skip the export step and only clear data
 *   --yes              Skip confirmation prompt
 */

import { $ } from 'bun'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const args = process.argv.slice(2)
const isProduction = args.includes('--env') && args[args.indexOf('--env') + 1] === 'production'
const skipExport = args.includes('--skip-export')
const autoYes = args.includes('--yes')

const dbName = 'vibe_rank'
const envFlag = isProduction ? '--env production' : ''
const envLabel = isProduction ? 'PRODUCTION' : 'STAGING'

async function confirmAction(): Promise<boolean> {
  if (autoYes) return true

  console.log(`\n⚠️  WARNING: This will DELETE ALL DATA from ${envLabel} database!`)
  console.log('This action cannot be undone.')
  console.log('\nType "yes" to continue or anything else to cancel:')

  const input = prompt('')
  return input?.toLowerCase() === 'yes'
}

async function exportDatabase() {
  console.log(`\n📦 Exporting ${envLabel} database...`)

  const backupDir = join(process.cwd(), 'backups')
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')
  const dateStr = timestamp[0]
  const timeStr = timestamp[1].substring(0, 8)
  const filename = `backup-${envLabel.toLowerCase()}-${dateStr}-${timeStr}.sql`
  const filepath = join(backupDir, filename)

  try {
    console.log(`💾 Saving to: ${filepath}`)

    // Export database to SQL file
    const exportCommand = isProduction
      ? `bunx wrangler d1 export ${dbName} --remote --env production --output ${filepath}`
      : `bunx wrangler d1 export ${dbName} --remote --output ${filepath}`

    await $`sh -c ${exportCommand}`

    console.log(`✅ Database exported successfully!`)
    console.log(`📁 Backup file: ${filepath}`)

    return filepath
  } catch (error) {
    console.error('❌ Failed to export database:', error)
    throw error
  }
}

async function clearDatabase() {
  console.log(`\n🗑️  Clearing ${envLabel} database...`)

  // SQL to delete all data (respecting foreign key constraints)
  // Delete in reverse order of dependencies
  const clearSQL = `
-- Delete child tables first
DELETE FROM onboarding;
DELETE FROM reports;
DELETE FROM photo_tags;
DELETE FROM ratings;

-- Delete parent tables
DELETE FROM photos;
DELETE FROM tags;
DELETE FROM events;

-- Delete users last
DELETE FROM users;
`.trim()

  const tempSqlFile = join(process.cwd(), 'temp-clear.sql')

  try {
    // Write SQL to temp file
    writeFileSync(tempSqlFile, clearSQL)

    // Execute via wrangler
    console.log('🚀 Executing deletion SQL...')
    const executeCommand = isProduction
      ? `bunx wrangler d1 execute ${dbName} --remote --env production --file=${tempSqlFile}`
      : `bunx wrangler d1 execute ${dbName} --remote --file=${tempSqlFile}`

    await $`sh -c ${executeCommand}`

    // Clean up temp file
    const { unlinkSync } = await import('fs')
    unlinkSync(tempSqlFile)

    console.log('\n✅ Database cleared successfully!')

    // Verify deletion with individual queries
    console.log('\n📊 Verifying deletion...')
    await verifyDeletion()
  } catch (error) {
    console.error('❌ Failed to clear database:', error)
    throw error
  }
}

async function verifyDeletion() {
  const tables = ['users', 'photos', 'ratings', 'tags', 'photo_tags', 'events', 'reports', 'onboarding']

  for (const table of tables) {
    try {
      const cmd = isProduction
        ? `bunx wrangler d1 execute ${dbName} --remote --env production --command "SELECT COUNT(*) as count FROM ${table}"`
        : `bunx wrangler d1 execute ${dbName} --remote --command "SELECT COUNT(*) as count FROM ${table}"`

      const result = await $`sh -c ${cmd}`.text()

      // Parse count from output
      const lines = result.split('\n')
      const countLine = lines.find(line => /^\d+$/.test(line.trim()))
      const count = countLine ? parseInt(countLine.trim()) : -1

      if (count === 0) {
        console.log(`✅ ${table}: 0 rows`)
      } else {
        console.log(`⚠️  ${table}: ${count} rows remaining`)
      }
    } catch (error) {
      console.log(`❌ ${table}: failed to verify`)
    }
  }
}

async function main() {
  console.log(`\n🔧 Export and Clear D1 Database`)
  console.log(`📍 Environment: ${envLabel}`)
  console.log(`🗄️  Database: ${dbName}`)

  // Step 1: Confirm action
  if (!await confirmAction()) {
    console.log('\n❌ Operation cancelled')
    process.exit(0)
  }

  // Step 2: Export database (unless skipped)
  if (!skipExport) {
    await exportDatabase()
  } else {
    console.log('\n⏭️  Skipping export step')
  }

  // Step 3: Clear database
  await clearDatabase()

  console.log('\n🎉 Operation complete!')
  if (!skipExport) {
    console.log('💡 Your data has been backed up before deletion')
  }
}

main()
  .catch((error) => {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  })
