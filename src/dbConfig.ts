import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'
import { getEnvVar } from './env'

let prismaInstance: PrismaClient | null = null
let isConnecting = false

const requireEnv = (name: string): string => {
  const value = getEnvVar(name)
  if (!value) {
    throw new Error(
      `Database configuration error: environment variable '${name}' is missing or empty.\n` +
      `- Ensure it is set as a Cloudflare Worker secret: wrangler secret put ${name}\n` +
      `- For local dev, set it in your environment before starting the server.\n`
    )
  }
  return value
}

export const getPrisma = (env?: any): PrismaClient => {
  if (prismaInstance) return prismaInstance

  if (isConnecting) {
    throw new Error('Database connection is being established, please wait')
  }

  isConnecting = true

  try {
    // 1. 開發環境 SQLite 覆蓋 (file: or :memory:)
    const databaseUrl = process.env?.DATABASE_URL
    if (databaseUrl && /^(file:|:memory:)/i.test(databaseUrl)) {
      prismaInstance = new PrismaClient({
        datasourceUrl: databaseUrl,
        log: ['error']
      })
      return prismaInstance
    }

    // 2. Turso/libSQL connection (for scripts and non-Worker environments)
    const tursoUrl = process.env?.TURSO_DATABASE_URL || getEnvVar('TURSO_DATABASE_URL')
    const tursoToken = process.env?.TURSO_AUTH_TOKEN || getEnvVar('TURSO_AUTH_TOKEN')

    if (tursoUrl && tursoToken) {
      const libsql = createClient({
        url: tursoUrl,
        authToken: tursoToken,
      })
      const adapter = new PrismaLibSQL(libsql)
      prismaInstance = new PrismaClient({
        adapter,
        log: ['error']
      })
      return prismaInstance
    }

    // 3. D1 binding (Cloudflare Workers environment)
    const envToUse = env || (globalThis as any).__ENV

    if (!envToUse || !envToUse.DB) {
      throw new Error(
        'No database connection available.\n' +
        '- For Workers: ensure env.DB is bound\n' +
        '- For scripts: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN\n' +
        '- For local dev: use DATABASE_URL=file:./dev.db'
      )
    }

    const adapter = new PrismaD1(envToUse.DB)

    prismaInstance = new PrismaClient({
      adapter,
      log: ['error']
    })

    return prismaInstance
  } finally {
    isConnecting = false
  }
}

export default getPrisma