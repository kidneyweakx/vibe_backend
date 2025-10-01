#!/usr/bin/env bun

import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client } from '../src/services/r2/r2Client'

type ExecuteOptions = { remote: boolean; databaseName: string }

function ensureEnvVars() {
  const required = [
    'R2_ACCOUNT_ID',
    'R2_BUCKET_NAME',
    'R2_ACCESS_KEY',
    'R2_SECRET_KEY',
  ]
  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}.`)
  }
}

async function runWranglerD1(sql: string, opts: ExecuteOptions, expectJson: boolean = true): Promise<any> {
  const args = ['d1', 'execute', opts.databaseName, '--command', sql]
  if (opts.remote) args.push('--remote')
  if (expectJson) args.push('--json')

  const proc = Bun.spawn(['wrangler', ...args], { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`wrangler failed (code ${exitCode}).\nArgs: ${args.join(' ')}\n${stderr}`)
  }
  if (!expectJson) return stdout
  try {
    return JSON.parse(stdout)
  } catch (e) {
    throw new Error(`Failed to parse wrangler JSON output: ${e}\nOutput: ${stdout}`)
  }
}

async function d1SelectKeys(opts: ExecuteOptions): Promise<string[]> {
  const res = await runWranglerD1('SELECT key FROM photos;', opts, true)
  // wrangler --json returns an array of result sets; pick the first
  const rows: Array<{ key: string }> = (res?.result || res?.[0]?.results || res?.results || [])
  if (Array.isArray(rows) && rows.length && 'key' in rows[0]) return rows.map((r: any) => r.key)
  // Fallback shape
  if (Array.isArray(res) && res.length && res[0]?.results) return res[0].results.map((r: any) => r.key)
  return []
}

async function d1Count(table: string, opts: ExecuteOptions): Promise<number> {
  const res = await runWranglerD1(`SELECT COUNT(1) as c FROM ${table};`, opts, true)
  const row = res?.result?.[0] || res?.[0]?.results?.[0] || res?.results?.[0]
  return row?.c ?? 0
}

async function d1ExecMany(statements: string[], opts: ExecuteOptions): Promise<void> {
  // Execute as one batch separated by \n; D1 supports multiple statements
  const sql = statements.join('\n')
  await runWranglerD1(sql, opts, false)
}

async function cleanupAllUsers(opts: ExecuteOptions): Promise<void> {
  const { client, bucketName } = getR2Client()

  console.log('🔍 Query D1 for users and photos...')

  const [userCount, photoCount] = await Promise.all([
    d1Count('users', opts),
    d1Count('photos', opts)
  ])

  console.log(`Found ${userCount} users and ${photoCount} photos`)
  if (userCount === 0) {
    console.log('✅ No users found, nothing to clean up')
    return
  }

  // 先取得所有照片 key 以便刪除 R2 檔案
  const photoKeys = await d1SelectKeys(opts)

  // 刪除 R2 中的照片文件
  let deletedR2Count = 0
  for (const key of photoKeys) {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }))
      deletedR2Count++
      console.log(`🗑️  Deleted R2 object: ${key}`)
    } catch (err) {
      console.warn(`⚠️  Failed to delete R2 object ${key}:`, err)
    }
  }

  // 為避免外鍵限制，先清掉相依表，再刪 photos 與 users
  console.log('🧹 Deleting rows from D1 (ratings, photo_tags, reports, onboarding, photos, users)...')
  await d1ExecMany([
    'DELETE FROM ratings;',
    'DELETE FROM photo_tags;',
    'DELETE FROM reports;',
    'DELETE FROM onboarding;',
    'DELETE FROM photos;',
    'DELETE FROM users;'
  ], opts)

  const [leftUsers, leftPhotos] = await Promise.all([
    d1Count('users', opts),
    d1Count('photos', opts)
  ])

  console.log('✅ Cleanup completed:')
  console.log(`   - ${deletedR2Count} R2 objects deleted`)
  console.log(`   - photos remaining in D1: ${leftPhotos}`)
  console.log(`   - users remaining in D1: ${leftUsers}`)
}

async function main() {
  ensureEnvVars()

  const args = process.argv.slice(2)
  const confirmed = args.includes('--confirm')
  const remote = args.includes('--remote')
  const dbNameFlagIndex = args.indexOf('--db')
  const databaseName = dbNameFlagIndex !== -1 && args[dbNameFlagIndex + 1] ? args[dbNameFlagIndex + 1] : (process.env.D1_DATABASE_NAME || 'vibe_rank')

  if (!confirmed) {
    console.log('⚠️  This will delete ALL users and their photos from D1 and R2!')
    console.log('   Add --confirm flag to proceed:')
    console.log('   bun run scripts/cleanup-users.ts --confirm [--remote] [--db vibe_rank]')
    process.exit(0)
  }

  console.log('🚀 Starting user cleanup (D1 + R2)...')
  console.log(`   D1 database: ${databaseName} ${remote ? '(remote)' : '(local)'}`)

  await cleanupAllUsers({ remote, databaseName })
  console.log('🎉 User cleanup completed')
}

main().catch((err) => {
  console.error('❌ Cleanup failed:', err)
  process.exit(1)
})