import { join } from 'path'
import { writeFile } from 'fs/promises'
import { $ } from 'bun'

export type ImportMode = 'test' | 'production'

export const getD1DbName = (opts: { d1Db?: string; env?: ImportMode }): string => {
  if (opts.d1Db && opts.d1Db.trim().length > 0) return opts.d1Db
  return opts.env === 'production' ? 'vibe_rank' : 'vibe_rank_test'
}

export async function d1Execute(dbName: string, sql: string): Promise<void> {
  const tempFile = join(process.cwd(), `temp-import-${Date.now()}.sql`)
  await writeFile(tempFile, sql)
  try {
    await $`sh -c ${`bunx wrangler d1 execute ${dbName} --remote --file=${tempFile}`}`
  } finally {
    try { await (await import('fs')).promises.unlink(tempFile) } catch {}
  }
}

export async function getD1Columns(dbName: string, table: string): Promise<Set<string>> {
  try {
    const command = `bunx wrangler d1 execute ${dbName} --remote --command "PRAGMA table_info('${table}')"`
    const out = await $`sh -c ${command}`.text()
    const match = out.match(/\[\s*\{[\s\S]*\}\s*\]/)
    if (!match) return fallbackColumns(table)
    const arr = JSON.parse(match[0])
    const results = Array.isArray(arr) && arr[0]?.results ? arr[0].results : []
    if (!Array.isArray(results) || results.length === 0) return fallbackColumns(table)
    const cols = new Set<string>()
    for (const row of results) {
      if (row && typeof row.name === 'string') cols.add(row.name)
    }
    if (cols.size === 0) return fallbackColumns(table)
    return cols
  } catch {
    return fallbackColumns(table)
  }
}

function fallbackColumns(table: string): Set<string> {
  if (table === 'users') {
    return new Set([
      'id','email','name','gender','provider','providerId','createdAt','updatedAt'
    ])
  }
  if (table === 'photos') {
    return new Set([
      'id','userId','key','url','format','size','uploadedAt'
    ])
  }
  return new Set()
}

export const sqlString = (val: string | null | undefined) => {
  if (val == null) return 'NULL'
  return `'${val.replace(/'/g, "''")}'`
}

export const sqlBool = (val: boolean | number | null | undefined) => (val ? '1' : '0')

export const sqlValue = (val: any) => {
  if (val === null || val === undefined) return 'NULL'
  const t = typeof val
  if (t === 'number') return String(val)
  if (t === 'boolean') return sqlBool(val)
  // Dates or others: stringify and quote
  return sqlString(String(val))
}

export async function d1InsertUserAndPhoto(dbName: string, user: Record<string, any>, photo: Record<string, any>): Promise<void> {
  const usersCols = await getD1Columns(dbName, 'users')
  const photosCols = await getD1Columns(dbName, 'photos')

  const userColumns: string[] = []
  const userValues: string[] = []
  for (const [k, v] of Object.entries(user)) {
    if (usersCols.has(k)) {
      userColumns.push(k)
      userValues.push(sqlValue(v))
    }
  }

  const photoColumns: string[] = []
  const photoValues: string[] = []
  for (const [k, v] of Object.entries(photo)) {
    if (photosCols.has(k)) {
      photoColumns.push(k)
      photoValues.push(sqlValue(v))
    }
  }

  if (userColumns.length === 0 || photoColumns.length === 0) {
    throw new Error(`D1 insert has no columns to insert (users=${userColumns.length}, photos=${photoColumns.length})`)
  }

  const sql = `INSERT INTO users (${userColumns.join(',')}) VALUES (${userValues.join(',')});\nINSERT INTO photos (${photoColumns.join(',')}) VALUES (${photoValues.join(',')});\n`
  await d1Execute(dbName, sql)
}


