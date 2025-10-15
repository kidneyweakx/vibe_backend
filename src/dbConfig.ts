import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'

let prismaInstance: PrismaClient | null = null
let isConnecting = false

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

    // 2. D1 binding (Cloudflare Workers environment)
    const envToUse = env || (globalThis as any).__ENV

    if (!envToUse || !envToUse.DB) {
      throw new Error(
        'No database connection available.\n' +
        '- For Workers: ensure env.DB is bound\n' +
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