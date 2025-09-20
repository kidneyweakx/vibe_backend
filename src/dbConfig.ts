import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
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

export const getPrisma = (): PrismaClient => {
  if (prismaInstance) return prismaInstance

  // 防止並行創建多個實例
  if (isConnecting) {
    throw new Error('Database connection is being established, please wait')
  }

  isConnecting = true

  try {
    // Test/dev override: if DATABASE_URL is set to a SQLite URL, prefer it.
    const databaseUrl = (typeof process !== 'undefined' ? (process.env as any)?.DATABASE_URL : undefined) as string | undefined
    if (databaseUrl && /^(file:|:memory:)/i.test(databaseUrl)) {
      prismaInstance = new PrismaClient({ 
        datasourceUrl: databaseUrl, 
        log: ['error'],
        // 添加連接池配置
        __internal: {
          engine: {
            connectTimeout: 5000, // 5秒連接超時
            queryTimeout: 10000,  // 10秒查詢超時
          }
        }
      })
      return prismaInstance
    }

    const rawUrl = requireEnv('TURSO_DATABASE_URL')
    const authToken = requireEnv('TURSO_AUTH_TOKEN')

    // Normalize: if no scheme is provided, default to libsql:// as per Turso docs
    const hasScheme = /^(libsql|https?):\/\//i.test(rawUrl) || /^(file:|:memory:)/i.test(rawUrl)
    const url = hasScheme ? rawUrl : `libsql://${rawUrl}`

    // Best-effort diagnostics: print the effective host and scheme (do not expose token)
    try {
      const probe = (url.startsWith('libsql://') ? url.replace(/^libsql:\/\//i, 'https://') : url)
      const u = new URL(probe)
      console.error('db:client:init', { scheme: u.protocol.replace(':', ''), host: u.host })
    } catch {}

    const adapter = new PrismaLibSQL({ 
      url, 
      authToken,
      // 添加連接超時設置
      connectTimeout: 5000,
      queryTimeout: 10000,
    })
    
    prismaInstance = new PrismaClient({ 
      adapter, 
      log: ['error'],
      // 添加連接池配置
      __internal: {
        engine: {
          connectTimeout: 5000,
          queryTimeout: 10000,
        }
      }
    })
    
    return prismaInstance
  } finally {
    isConnecting = false
  }
}

export default getPrisma