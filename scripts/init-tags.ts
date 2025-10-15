#!/usr/bin/env bun

import { nanoid } from 'nanoid'
import type { ImportMode } from './lib/d1'
import { d1Execute, getD1Columns, getD1DbName, sqlValue } from './lib/d1'

type TagSeed = {
  name: string
  displayName: string
  emoji?: string | null
  color?: string | null
  category?: string | null
  normal?: boolean
}

const tags: TagSeed[] = [
  { name: 'sporty', displayName: 'Sporty' },
  { name: 'streetwear', displayName: 'Streetwear' },
  { name: 'vintage', displayName: 'Vintage' },
  { name: 'minimalist', displayName: 'Minimalist' },
  { name: 'formal', displayName: 'Formal' },
  { name: 'coquette', displayName: 'Coquette' },
  { name: 'gorpcore', displayName: 'Gorpcore' },
  { name: 'y2k', displayName: 'Y2K' },
  { name: 'preppy', displayName: 'Preppy' },
  { name: 'darkwear', displayName: 'Darkwear' },
]

interface CliOptions {
  d1: boolean
  env?: ImportMode
  d1Db?: string
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  const envArg = args.find(arg => arg.startsWith('--env='))
  const d1DbArg = args.find(arg => arg.startsWith('--d1-db='))

  let env: ImportMode | undefined
  if (envArg) {
    const value = envArg.split('=')[1]
    if (value === 'test' || value === 'production') {
      env = value
    }
  }

  const d1Db = d1DbArg ? d1DbArg.split('=')[1] : undefined
  const useLocal = args.includes('--local')
  const d1 = useLocal ? false : args.includes('--d1') ? true : true

  return {
    d1,
    env,
    d1Db
  }
}

async function seedTagsD1(options: CliOptions) {
  const dbName = getD1DbName({ d1Db: options.d1Db, env: options.env })
  console.log(`Seeding ${tags.length} English tags to D1 database "${dbName}"...`)

  const columns = await getD1Columns(dbName, 'tags')
  if (!columns.has('name')) throw new Error('D1 tags table missing "name" column')
  if (!columns.has('displayName')) throw new Error('D1 tags table missing "displayName" column')

  const statements: string[] = []

  for (const tag of tags) {
    const insertColumns: string[] = []
    const insertValues: string[] = []
    const inserted = new Set<string>()

    if (columns.has('id')) {
      insertColumns.push('id')
      insertValues.push(sqlValue(nanoid()))
      inserted.add('id')
    }

    insertColumns.push('name')
    insertValues.push(sqlValue(tag.name))
    inserted.add('name')

    insertColumns.push('displayName')
    insertValues.push(sqlValue(tag.displayName))
    inserted.add('displayName')

    if (tag.emoji !== undefined && columns.has('emoji')) {
      insertColumns.push('emoji')
      insertValues.push(sqlValue(tag.emoji))
      inserted.add('emoji')
    }

    if (tag.color !== undefined && columns.has('color')) {
      insertColumns.push('color')
      insertValues.push(sqlValue(tag.color))
      inserted.add('color')
    }

    if (tag.category !== undefined && columns.has('category')) {
      insertColumns.push('category')
      insertValues.push(sqlValue(tag.category))
      inserted.add('category')
    }

    if (tag.normal !== undefined && columns.has('normal')) {
      insertColumns.push('normal')
      insertValues.push(sqlValue(tag.normal))
      inserted.add('normal')
    }

    const updates: string[] = []
    if (inserted.has('displayName')) updates.push('displayName=excluded.displayName')
    if (inserted.has('emoji') && tag.emoji !== undefined) updates.push('emoji=excluded.emoji')
    if (inserted.has('color') && tag.color !== undefined) updates.push('color=excluded.color')
    if (inserted.has('category') && tag.category !== undefined) updates.push('category=excluded.category')
    if (inserted.has('normal') && tag.normal !== undefined) updates.push('normal=excluded.normal')

    const sql = updates.length > 0
      ? `INSERT INTO tags (${insertColumns.join(',')}) VALUES (${insertValues.join(',')}) ON CONFLICT(name) DO UPDATE SET ${updates.join(', ')};`
      : `INSERT INTO tags (${insertColumns.join(',')}) VALUES (${insertValues.join(',')}) ON CONFLICT(name) DO NOTHING;`

    statements.push(sql)
    console.log(`↻ ${tag.displayName} (${tag.name})`)
  }

  await d1Execute(dbName, statements.join('\n'))
  console.log('✅ Finished seeding tags to D1.')
}

async function seedTagsLocal() {
  console.log(`Seeding ${tags.length} English tags via Prisma...`)
  const { default: getPrisma } = await import('../src/dbConfig')
  const prisma = getPrisma()

  try {
    for (const tag of tags) {
      await prisma.tag.upsert({
        where: { name: tag.name },
        update: {
          displayName: tag.displayName,
          ...(tag.emoji !== undefined ? { emoji: tag.emoji } : {}),
          ...(tag.color !== undefined ? { color: tag.color } : {}),
          ...(tag.category !== undefined ? { category: tag.category } : {}),
          ...(tag.normal !== undefined ? { normal: tag.normal } : {}),
        },
        create: {
          name: tag.name,
          displayName: tag.displayName,
          ...(tag.emoji !== undefined ? { emoji: tag.emoji } : {}),
          ...(tag.color !== undefined ? { color: tag.color } : {}),
          ...(tag.category !== undefined ? { category: tag.category } : {}),
          ...(tag.normal !== undefined ? { normal: tag.normal } : {}),
        },
      })
      console.log(`✅ ${tag.displayName} (${tag.name})`)
    }
  } catch (error: any) {
    if (error?.code === 'P2021') {
      throw new Error('Tags table not found in local database. Run migrations or re-run with --d1 to target remote D1.')
    }
    throw error
  } finally {
    await prisma.$disconnect()
  }

  console.log('✅ Finished seeding tags locally.')
}

async function main() {
  const options = parseArgs()
  if (options.d1) {
    await seedTagsD1(options)
  } else {
    await seedTagsLocal()
  }
}

main().catch((error) => {
  console.error('❌ Failed to seed tags:', error)
  process.exit(1)
})


